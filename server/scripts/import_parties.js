const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 1. Locate Vyapar database or fallback
const scratchVyp = 'C:/Users/mdana/.gemini/antigravity-ide/brain/73cf8914-c9c0-4b73-9238-2d65c5190a87/scratch/THE MALABAR OILS.vyp';
const partiesJsonPath = path.join(__dirname, '..', 'data', 'parties.json');

// Ensure server/data dir exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function detectArea(name, address) {
  const text = ((name || '') + ' ' + (address || '')).toUpperCase();
  
  if (text.includes('BATLAGUNDU') || text.includes('BATHALAGUNDU') || /\b(BTL|BYL)\b/.test(text)) return 'Batlagundu';
  if (text.includes('ALAGAR')) return 'Alagarsamipuram';
  if (text.includes('SBI')) return 'SBI Colony';
  if (text.includes('VADUGAPATTI') || /\bVPT\b/.test(text)) return 'Vadugapatti';
  if (text.includes('THANDUPALAYAM')) return 'Thandupalayam';
  if (text.includes('DEVADANAPATTI') || /\bDVP\b/.test(text)) return 'Devadanapatti';
  if (text.includes('THENKARAI') || /\bTKM\b/.test(text)) return 'Thenkarai';
  if (text.includes('SENGUTTAI') || /\bSKT\b/.test(text)) return 'Senguttai';
  if (text.includes('VADAGARAI')) return 'Vadagarai';
  if (text.includes('LAKSHMIPURAM') || /\b(LKP|LKM)\b/.test(text)) return 'Lakshmipuram';
  if (text.includes('MARKET')) return 'Market';
  if (text.includes('THENI')) return 'Theni';
  if (text.includes('KODAI')) return 'Kodaikanal';
  if (text.includes('CUMBUM')) return 'Cumbum';
  if (text.includes('BODI')) return 'Bodi';
  if (text.includes('GANDHI')) return 'Gandhi Nagar';

  return 'Periyakulam';
}

function loadPartiesFromVyapar() {
  if (!fs.existsSync(scratchVyp)) {
    throw new Error(`Vyapar database not found at ${scratchVyp}`);
  }

  const vypDb = new Database(scratchVyp, { readonly: true });
  const rawParties = vypDb.prepare(`
    SELECT 
      n.name_id, 
      n.full_name, 
      n.party_billing_name, 
      n.phone_number, 
      n.email, 
      n.address, 
      n.pincode, 
      n.name_state, 
      n.name_country, 
      n.name_gstin_number, 
      n.name_tin_number, 
      n.amount, 
      n.credit_limit, 
      n.name_is_active, 
      n.name_last_txn_date 
    FROM kb_names n 
    WHERE n.name_type = 1 
    ORDER BY n.full_name ASC
  `).all();

  vypDb.close();

  return rawParties.map(p => {
    const id = `PRT-${String(p.name_id).padStart(3, '0')}`;
    const name = p.full_name.trim();
    const phone = (p.phone_number || '').trim();
    const address = (p.address || '').trim() || null;
    const area = detectArea(name, address);
    const balance = Number(p.amount || 0);

    return {
      id,
      vyapar_id: p.name_id,
      name,
      contact_person: p.party_billing_name ? p.party_billing_name.trim() : null,
      phone,
      whatsapp: phone || null,
      address,
      area,
      opening_balance: balance,
      credit_limit: Number(p.credit_limit || 0),
      payment_terms_days: 15,
      notes: null,
      status: 'active',
      last_transaction_date: p.name_last_txn_date || null
    };
  });
}

async function syncToSupabase(parties) {
  const { createClient } = require(path.join(__dirname, '..', '..', 'client', 'node_modules', '@supabase/supabase-js'));
  const supabaseUrl = 'https://thacoqdgeuuvhcnyoqxo.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoYWNvcWRnZXV1dmhjbnlvcXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4Mzk4MzYsImV4cCI6MjEwODQxNTgzNn0.M0Ilb2j681GTiozcl8hoTTXs_58HHPiLPvZ2c0qtaz4';

  const sb = createClient(supabaseUrl, supabaseAnonKey);

  console.log(`[Supabase] Syncing ${parties.length} parties...`);

  // Format parties for Supabase schema
  const rows = parties.map(p => ({
    id: p.id,
    name: p.name,
    contact_person: p.contact_person,
    phone: p.phone,
    whatsapp: p.whatsapp,
    address: p.address,
    area: p.area,
    opening_balance: p.opening_balance,
    credit_limit: p.credit_limit,
    payment_terms_days: p.payment_terms_days,
    notes: p.notes,
    status: p.status
  }));

  // Batch upsert in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await sb.from('parties').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`[Supabase] Batch upsert error at index ${i}:`, error.message);
      throw error;
    }
  }
  console.log(`[Supabase] Successfully upserted ${rows.length} parties.`);

  // Sync opening balances into party_ledger
  console.log('[Supabase] Syncing opening balance ledger entries...');
  const ledgerEntries = parties
    .filter(p => p.opening_balance !== 0)
    .map(p => ({
      party_id: p.id,
      entry_date: '2026-10-01',
      entry_type: 'OPENING_BALANCE',
      reference_id: `OPB-${p.id}`,
      description: 'Initial Opening Balance imported from Vyapar',
      debit: p.opening_balance > 0 ? p.opening_balance : 0,
      credit: p.opening_balance < 0 ? Math.abs(p.opening_balance) : 0
    }));

  for (const entry of ledgerEntries) {
    // Check if entry already exists
    const { data: existing } = await sb
      .from('party_ledger')
      .select('id')
      .eq('party_id', entry.party_id)
      .eq('entry_type', 'OPENING_BALANCE')
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await sb
        .from('party_ledger')
        .update({
          debit: entry.debit,
          credit: entry.credit,
          entry_date: entry.entry_date,
          reference_id: entry.reference_id,
          description: entry.description
        })
        .eq('id', existing.id);
      if (updErr) console.error(`[Supabase] Ledger update error for ${entry.party_id}:`, updErr.message);
    } else {
      const { error: insErr } = await sb.from('party_ledger').insert(entry);
      if (insErr) console.error(`[Supabase] Ledger insert error for ${entry.party_id}:`, insErr.message);
    }
  }

  console.log(`[Supabase] Synced ${ledgerEntries.length} opening balance ledger entries.`);
}

function syncToSQLite(parties) {
  const dbPath = path.join(__dirname, '..', 'data', 'orderflow.db');
  const db = new Database(dbPath);

  console.log(`[SQLite] Syncing ${parties.length} parties to ${dbPath}...`);

  db.pragma('foreign_keys = OFF');

  const tx = db.transaction(() => {
    // Clean mock dummy data (PRT-001 to PRT-007 from Coimbatore seed)
    const mockPartyIds = ['PRT-001', 'PRT-002', 'PRT-003', 'PRT-004', 'PRT-005', 'PRT-006'];
    for (const mId of mockPartyIds) {
      db.prepare('DELETE FROM payment_allocations WHERE party_id = ? OR order_id IN (SELECT id FROM sales_orders WHERE party_id = ?)').run(mId, mId);
      db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM sales_orders WHERE party_id = ?)').run(mId);
      db.prepare('DELETE FROM payments WHERE party_id = ?').run(mId);
      db.prepare('DELETE FROM sales_orders WHERE party_id = ?').run(mId);
      db.prepare('DELETE FROM party_ledger WHERE party_id = ?').run(mId);
      db.prepare('DELETE FROM follow_up_notes WHERE party_id = ?').run(mId);
      db.prepare('DELETE FROM parties WHERE id = ?').run(mId);
    }
    // Also remove PRT-007 mock party if named Bismillah Daily Needs
    const prt7 = db.prepare('SELECT name FROM parties WHERE id = ?').get('PRT-007');
    if (prt7 && prt7.name === 'Bismillah Daily Needs') {
      db.prepare('DELETE FROM party_ledger WHERE party_id = ?').run('PRT-007');
      db.prepare('DELETE FROM parties WHERE id = ?').run('PRT-007');
    }

    const insertOrReplaceParty = db.prepare(`
      INSERT INTO parties (id, name, contact_person, phone, whatsapp, address, area, opening_balance, credit_limit, payment_terms_days, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        contact_person = excluded.contact_person,
        phone = excluded.phone,
        whatsapp = excluded.whatsapp,
        address = excluded.address,
        area = excluded.area,
        opening_balance = excluded.opening_balance,
        credit_limit = excluded.credit_limit,
        payment_terms_days = excluded.payment_terms_days,
        status = excluded.status,
        updated_at = datetime('now', 'localtime')
    `);

    for (const p of parties) {
      insertOrReplaceParty.run(
        p.id,
        p.name,
        p.contact_person,
        p.phone,
        p.whatsapp,
        p.address,
        p.area,
        p.opening_balance,
        p.credit_limit,
        p.payment_terms_days,
        p.notes,
        p.status
      );
    }

    // Sync opening balances into party_ledger
    db.prepare("DELETE FROM party_ledger WHERE entry_type = 'OPENING_BALANCE'").run();

    const insertLedger = db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-01', 'OPENING_BALANCE', ?, 'Initial Opening Balance imported from Vyapar', ?, ?)
    `);

    let ledgerCount = 0;
    for (const p of parties) {
      if (p.opening_balance !== 0) {
        const debit = p.opening_balance > 0 ? p.opening_balance : 0;
        const credit = p.opening_balance < 0 ? Math.abs(p.opening_balance) : 0;
        insertLedger.run(p.id, `OPB-${p.id}`, debit, credit);
        ledgerCount++;
      }
    }

    console.log(`[SQLite] Inserted ${parties.length} parties and ${ledgerCount} ledger entries.`);
  });

  tx();
  db.pragma('foreign_keys = ON');
  db.close();
}

async function main() {
  console.log('=== Starting Vyapar Parties Import ===');

  const parties = loadPartiesFromVyapar();
  console.log(`Loaded ${parties.length} parties from Vyapar DB.`);

  // Write parties.json
  fs.writeFileSync(partiesJsonPath, JSON.stringify(parties, null, 2), 'utf-8');
  console.log(`Saved parties archive to: ${partiesJsonPath}`);

  // Sync to SQLite
  syncToSQLite(parties);

  // Sync to Supabase
  await syncToSupabase(parties);

  console.log('=== Import Completed Successfully ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
