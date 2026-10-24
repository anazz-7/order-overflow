const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { db, recordAuditLog } = require('../db');

// GET all products with filtering & search
router.get('/', (req, res) => {
  try {
    const { search, category, status } = req.query;
    let query = `SELECT * FROM products WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR sku LIKE ? OR brand LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY category ASC, name ASC`;

    const products = db.prepare(query).all(...params);
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET categories
router.get('/meta/categories', (req, res) => {
  try {
    const cats = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC').all();
    res.json({ success: true, data: cats.map(c => c.category) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single product
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create product
router.post('/', (req, res) => {
  try {
    const {
      sku,
      name,
      category,
      brand,
      unit,
      pack_size,
      selling_price,
      min_order_qty = 1,
      stock_quantity = 0,
      user_name = 'Admin'
    } = req.body;

    if (!sku || !name || !category || !unit || selling_price === undefined) {
      return res.status(400).json({ success: false, error: 'SKU, Name, Category, Unit, and Selling Price are required.' });
    }

    // Check duplicate SKU
    const existingSku = db.prepare('SELECT id FROM products WHERE LOWER(sku) = LOWER(?)').get(sku.trim());
    if (existingSku) {
      return res.status(400).json({ success: false, error: `SKU "${sku}" is already in use by product ${existingSku.id}.` });
    }

    const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
    const newId = `PRD-${String(count + 1).padStart(3, '0')}`;

    db.prepare(`
      INSERT INTO products (id, sku, name, category, brand, unit, pack_size, selling_price, min_order_qty, stock_quantity, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      newId,
      sku.trim().toUpperCase(),
      name.trim(),
      category.trim(),
      brand ? brand.trim() : null,
      unit.trim(),
      pack_size ? pack_size.trim() : null,
      parseFloat(selling_price) || 0,
      parseInt(min_order_qty) || 1,
      parseInt(stock_quantity) || 0
    );

    recordAuditLog('PRODUCT', newId, 'CREATE', `Created product ${name} (${sku}) at ₹${selling_price}`, user_name);

    res.status(201).json({ success: true, message: 'Product created successfully', data: { id: newId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update product
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      sku,
      name,
      category,
      brand,
      unit,
      pack_size,
      selling_price,
      min_order_qty,
      stock_quantity,
      status,
      user_name = 'Admin'
    } = req.body;

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (sku && sku.trim().toLowerCase() !== existing.sku.toLowerCase()) {
      const duplicateSku = db.prepare('SELECT id FROM products WHERE LOWER(sku) = LOWER(?) AND id != ?').get(sku.trim(), id);
      if (duplicateSku) {
        return res.status(400).json({ success: false, error: `SKU "${sku}" is already used by another product.` });
      }
    }

    db.prepare(`
      UPDATE products
      SET sku = COALESCE(?, sku),
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          brand = COALESCE(?, brand),
          unit = COALESCE(?, unit),
          pack_size = COALESCE(?, pack_size),
          selling_price = COALESCE(?, selling_price),
          min_order_qty = COALESCE(?, min_order_qty),
          stock_quantity = COALESCE(?, stock_quantity),
          status = COALESCE(?, status),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      sku ? sku.trim().toUpperCase() : null,
      name ? name.trim() : null,
      category ? category.trim() : null,
      brand !== undefined ? brand : null,
      unit ? unit.trim() : null,
      pack_size !== undefined ? pack_size : null,
      selling_price !== undefined ? parseFloat(selling_price) : null,
      min_order_qty !== undefined ? parseInt(min_order_qty) : null,
      stock_quantity !== undefined ? parseInt(stock_quantity) : null,
      status || null,
      id
    );

    recordAuditLog('PRODUCT', id, 'UPDATE', `Updated product ${existing.name}`, user_name);

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST import products with preview / validation / duplicate check
router.post('/import-preview', (req, res) => {
  try {
    const { rows } = req.body; // Array of row objects from client-parsed CSV or Excel
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data rows provided for import.' });
    }

    const existingSkus = new Set(db.prepare('SELECT sku FROM products').all().map(p => p.sku.toLowerCase()));

    const validatedRows = rows.map((row, index) => {
      const errors = [];
      const warnings = [];

      const sku = (row.sku || row.SKU || row['Item Code'] || '').toString().trim().toUpperCase();
      const name = (row.name || row.Name || row['Product Name'] || '').toString().trim();
      const category = (row.category || row.Category || 'General Grocery').toString().trim();
      const brand = (row.brand || row.Brand || '').toString().trim();
      const unit = (row.unit || row.Unit || 'kg').toString().trim();
      const pack_size = (row.pack_size || row['Pack Size'] || '').toString().trim();
      const priceVal = parseFloat(row.selling_price || row['Selling Price'] || row.price || row.Price || 0);
      const stockVal = parseInt(row.stock_quantity || row['Stock Quantity'] || row.stock || 0) || 0;
      const minQtyVal = parseInt(row.min_order_qty || row['Min Order Qty'] || 1) || 1;

      if (!sku) errors.push('Missing SKU');
      if (!name) errors.push('Missing Product Name');
      if (isNaN(priceVal) || priceVal <= 0) errors.push('Invalid selling price');

      if (sku && existingSkus.has(sku.toLowerCase())) {
        warnings.push('SKU exists in database (will update if imported)');
      }

      return {
        row_index: index + 1,
        sku,
        name,
        category,
        brand,
        unit,
        pack_size,
        selling_price: isNaN(priceVal) ? 0 : priceVal,
        stock_quantity: stockVal,
        min_order_qty: minQtyVal,
        errors,
        warnings,
        is_valid: errors.length === 0,
        action: existingSkus.has(sku.toLowerCase()) ? 'UPDATE' : 'INSERT'
      };
    });

    const validCount = validatedRows.filter(r => r.is_valid).length;
    const errorCount = validatedRows.length - validCount;

    res.json({
      success: true,
      summary: {
        total_rows: validatedRows.length,
        valid_rows: validCount,
        invalid_rows: errorCount,
        new_items: validatedRows.filter(r => r.is_valid && r.action === 'INSERT').length,
        existing_items_to_update: validatedRows.filter(r => r.is_valid && r.action === 'UPDATE').length
      },
      rows: validatedRows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST commit imported products
router.post('/import-commit', (req, res) => {
  try {
    const { valid_rows, user_name = 'Admin' } = req.body;
    if (!Array.isArray(valid_rows) || valid_rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No validated rows to commit.' });
    }

    let inserted = 0;
    let updated = 0;

    const commitTx = db.transaction(() => {
      let count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;

      const checkSkuStmt = db.prepare('SELECT id FROM products WHERE sku = ?');
      const insertStmt = db.prepare(`
        INSERT INTO products (id, sku, name, category, brand, unit, pack_size, selling_price, min_order_qty, stock_quantity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `);
      const updateStmt = db.prepare(`
        UPDATE products
        SET name = ?, category = ?, brand = ?, unit = ?, pack_size = ?, selling_price = ?, min_order_qty = ?, stock_quantity = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const row of valid_rows) {
        const existing = checkSkuStmt.get(row.sku);
        if (existing) {
          updateStmt.run(
            row.name,
            row.category,
            row.brand || null,
            row.unit,
            row.pack_size || null,
            row.selling_price,
            row.min_order_qty || 1,
            row.stock_quantity || 0,
            existing.id
          );
          updated++;
        } else {
          count++;
          const newId = `PRD-${String(count).padStart(3, '0')}`;
          insertStmt.run(
            newId,
            row.sku,
            row.name,
            row.category,
            row.brand || null,
            row.unit,
            row.pack_size || null,
            row.selling_price,
            row.min_order_qty || 1,
            row.stock_quantity || 0
          );
          inserted++;
        }
      }

      recordAuditLog('PRODUCT', 'BULK_IMPORT', 'IMPORT', `Bulk catalog imported: ${inserted} inserted, ${updated} updated`, user_name);
    });

    commitTx();

    res.json({
      success: true,
      message: `Import completed: ${inserted} new products added, ${updated} existing products updated.`,
      stats: { inserted, updated }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET export products catalog to CSV or Excel
router.get('/export/:format', (req, res) => {
  try {
    const { format } = req.params; // 'csv' or 'excel'
    const products = db.prepare(`
      SELECT 
        id as "Product ID",
        sku as "SKU",
        name as "Product Name",
        category as "Category",
        brand as "Brand",
        unit as "Unit",
        pack_size as "Pack Size",
        selling_price as "Selling Price (₹)",
        min_order_qty as "Min Order Qty",
        stock_quantity as "Stock Quantity",
        status as "Status"
      FROM products
      ORDER BY category ASC, name ASC
    `).all();

    const worksheet = xlsx.utils.json_to_sheet(products);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Product Catalog');

    const filename = `Barakkath_Agencies_Product_Catalog_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csvBuffer = xlsx.write(workbook, { bookType: 'csv', type: 'buffer' });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvBuffer);
    } else {
      const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(excelBuffer);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
