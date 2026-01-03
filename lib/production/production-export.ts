/**
 * PRODUCTION EXPORT – PHASE 6
 * 
 * Generate human-readable (PDF) and machine-readable (JSON) production files.
 * Ensures deterministic output for manufacturing consistency.
 * 
 * Purpose:
 * - Export production snapshots as PDF for workshop printing
 * - Export JSON for automated manufacturing systems
 * - Provide visual preview and complete specifications
 * 
 * @module lib/production/production-export
 */

import type { ProductionSnapshot } from './production-snapshot';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface ProductionExportOptions {
  format: 'pdf' | 'json' | 'both';
  includePreview?: boolean;
  includeCustomerInfo?: boolean;
  locale?: string;
}

export interface ProductionExportResult {
  pdf?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  };
  json?: {
    data: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  };
  metadata: {
    exportedAt: string;
    snapshotId: string;
    orderId: string;
    version: string;
  };
}

// ============================================================
// JSON EXPORT
// ============================================================

/**
 * Export production snapshot as JSON
 * Machine-readable format for automated systems
 */
export function exportAsJSON(snapshot: ProductionSnapshot): string {
  // Create clean JSON structure optimized for manufacturing systems
  const exportData = {
    // Header
    export: {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      format: 'production-snapshot',
    },
    
    // Snapshot data
    snapshot: {
      snapshotId: snapshot.snapshotId,
      orderId: snapshot.orderId,
      orderItemId: snapshot.orderItemId,
      productId: snapshot.productId,
    },
    
    // Product specification
    product: {
      sku: snapshot.baseProduct.sku,
      name: snapshot.baseProduct.name,
      variant: snapshot.baseProduct.variant,
    },
    
    // Manufacturing specification
    manufacturing: {
      components: snapshot.selectedComponents.map(comp => ({
        componentId: comp.componentId,
        name: comp.name,
        category: comp.category,
        specification: comp.specification,
        quantity: comp.quantity,
        assemblyNotes: comp.assemblyNotes,
      })),
      materials: snapshot.materials.map(mat => ({
        materialId: mat.materialId,
        name: mat.name,
        type: mat.type,
        specification: mat.specification,
        quantity: mat.quantity,
        unit: mat.unit,
        supplier: mat.supplier,
        notes: mat.notes,
      })),
      colors: snapshot.colors?.map(color => ({
        colorId: color.colorId,
        name: color.name,
        type: color.type,
        value: color.value,
        finish: color.finish,
        application: color.application,
      })) || [],
    },
    
    // Quantities
    quantities: snapshot.quantities,
    
    // Pricing (for reference)
    pricing: snapshot.finalPrice,
    
    // Production notes
    production: {
      notes: snapshot.productionNotes,
      assemblyInstructions: snapshot.assemblyInstructions,
      qualityChecks: snapshot.qualityChecks,
    },
    
    // Customer reference (optional)
    customer: {
      orderNumber: snapshot.customerReference.orderNumber,
      name: snapshot.customerReference.customerName,
      shippingAddress: snapshot.customerReference.shippingAddress,
    },
    
    // Metadata
    metadata: {
      locked: snapshot.metadata.locked,
      lockReason: snapshot.metadata.lockReason,
      createdAt: snapshot.metadata.createdAt,
      checksumSHA256: snapshot.metadata.checksumSHA256,
    },
  };
  
  return JSON.stringify(exportData, null, 2);
}

// ============================================================
// PDF EXPORT (HTML-based)
// ============================================================

/**
 * Generate HTML content for PDF export
 * Will be converted to PDF using headless browser or PDF library
 */
export function generateProductionHTML(snapshot: ProductionSnapshot, options: ProductionExportOptions = {}): string {
  const locale = options.locale || 'de-DE';
  const includePreview = options.includePreview !== false;
  const includeCustomerInfo = options.includeCustomerInfo !== false;
  
  // Format currency
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: snapshot.finalPrice.currency,
    }).format(amount);
  };
  
  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Produktionsauftrag ${snapshot.snapshotId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #333;
      padding: 20mm;
      background: white;
    }
    
    .header {
      border-bottom: 3px solid #1976d2;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 24pt;
      color: #1976d2;
      margin-bottom: 5px;
    }
    
    .header .snapshot-id {
      font-size: 10pt;
      color: #666;
      font-family: 'Courier New', monospace;
    }
    
    .warning-box {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 20px 0;
    }
    
    .warning-box strong {
      color: #e65100;
      font-size: 12pt;
    }
    
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    
    .section h2 {
      font-size: 14pt;
      color: #1976d2;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 8px 20px;
      margin-bottom: 15px;
    }
    
    .info-label {
      font-weight: bold;
      color: #666;
    }
    
    .info-value {
      color: #333;
    }
    
    .preview-image {
      width: 100%;
      max-width: 400px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin: 15px 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    
    table th {
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      color: #333;
    }
    
    table td {
      border: 1px solid #e0e0e0;
      padding: 10px;
    }
    
    .component-row {
      background: white;
    }
    
    .component-row:nth-child(even) {
      background: #fafafa;
    }
    
    .material-type-primary {
      color: #1976d2;
      font-weight: bold;
    }
    
    .material-type-secondary {
      color: #757575;
    }
    
    .material-type-finish {
      color: #7b1fa2;
    }
    
    .material-type-addon {
      color: #388e3c;
    }
    
    .production-notes {
      background: #e3f2fd;
      border-left: 4px solid #1976d2;
      padding: 15px;
      margin: 15px 0;
    }
    
    .production-notes ul {
      margin-left: 20px;
    }
    
    .production-notes li {
      margin: 8px 0;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      font-size: 9pt;
      color: #666;
    }
    
    .checksum {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
      color: #999;
      word-break: break-all;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>Produktionsauftrag</h1>
    <div class="snapshot-id">Snapshot-ID: ${snapshot.snapshotId}</div>
    <div class="snapshot-id">Auftrags-ID: ${snapshot.orderId}</div>
  </div>
  
  <!-- Warning Box -->
  <div class="warning-box">
    <strong>⚠️ CUSTOM-MADE – KEINE ÄNDERUNGEN NACH PRODUKTIONSSTART</strong><br>
    Dieser Auftrag ist kundenspezifisch gefertigt. Alle Spezifikationen müssen vor Produktionsbeginn geprüft werden.
    Nach Start der Produktion sind keine Änderungen mehr möglich.
  </div>
  
  <!-- Preview Image -->
  ${includePreview && snapshot.previewImage ? `
  <div class="section">
    <h2>Produktvorschau</h2>
    <img src="${snapshot.previewImage.url}" alt="Produktvorschau" class="preview-image">
  </div>
  ` : ''}
  
  <!-- Product Information -->
  <div class="section">
    <h2>Produktinformationen</h2>
    <div class="info-grid">
      <div class="info-label">Produkt-ID:</div>
      <div class="info-value">${snapshot.productId}</div>
      
      <div class="info-label">Basisprodukt:</div>
      <div class="info-value">${snapshot.baseProduct.name} (${snapshot.baseProduct.sku})</div>
      
      <div class="info-label">Bestellmenge:</div>
      <div class="info-value">${snapshot.quantities.unitsOrdered} Stück</div>
      
      <div class="info-label">Komponenten gesamt:</div>
      <div class="info-value">${snapshot.quantities.componentsTotal}</div>
      
      <div class="info-label">Materialien gesamt:</div>
      <div class="info-value">${snapshot.quantities.materialsTotal}</div>
      
      <div class="info-label">Endpreis (Netto):</div>
      <div class="info-value">${formatPrice(snapshot.finalPrice.net)}</div>
      
      <div class="info-label">Endpreis (Brutto):</div>
      <div class="info-value">${formatPrice(snapshot.finalPrice.gross)}</div>
    </div>
  </div>
  
  <!-- Customer Information -->
  ${includeCustomerInfo ? `
  <div class="section">
    <h2>Kundeninformationen</h2>
    <div class="info-grid">
      <div class="info-label">Bestellnummer:</div>
      <div class="info-value">${snapshot.customerReference.orderNumber}</div>
      
      <div class="info-label">Kundenname:</div>
      <div class="info-value">${snapshot.customerReference.customerName}</div>
      
      <div class="info-label">Lieferadresse:</div>
      <div class="info-value">${snapshot.customerReference.shippingAddress.replace(/\n/g, '<br>')}</div>
    </div>
  </div>
  ` : ''}
  
  <!-- Selected Components -->
  <div class="section">
    <h2>Ausgewählte Komponenten</h2>
    <table>
      <thead>
        <tr>
          <th>Komponenten-ID</th>
          <th>Name</th>
          <th>Kategorie</th>
          <th>Spezifikation</th>
          <th>Menge</th>
        </tr>
      </thead>
      <tbody>
        ${snapshot.selectedComponents.map(comp => `
          <tr class="component-row">
            <td><code>${comp.componentId}</code></td>
            <td><strong>${comp.name}</strong></td>
            <td>${comp.category}</td>
            <td>${comp.specification}</td>
            <td>${comp.quantity}</td>
          </tr>
          ${comp.assemblyNotes ? `
            <tr>
              <td colspan="5" style="background: #fff3e0; font-size: 9pt;">
                <strong>Montageanleitung:</strong> ${comp.assemblyNotes}
              </td>
            </tr>
          ` : ''}
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <!-- Materials List -->
  <div class="section">
    <h2>Materialliste</h2>
    <table>
      <thead>
        <tr>
          <th>Material-ID</th>
          <th>Name</th>
          <th>Typ</th>
          <th>Spezifikation</th>
          <th>Menge</th>
          <th>Einheit</th>
          <th>Lieferant</th>
        </tr>
      </thead>
      <tbody>
        ${snapshot.materials.map(mat => `
          <tr class="component-row">
            <td><code>${mat.materialId}</code></td>
            <td><strong>${mat.name}</strong></td>
            <td class="material-type-${mat.type}">${mat.type}</td>
            <td>${mat.specification}</td>
            <td>${mat.quantity}</td>
            <td>${mat.unit}</td>
            <td>${mat.supplier || '-'}</td>
          </tr>
          ${mat.notes ? `
            <tr>
              <td colspan="7" style="background: #e3f2fd; font-size: 9pt;">
                <strong>Hinweis:</strong> ${mat.notes}
              </td>
            </tr>
          ` : ''}
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <!-- Colors (if any) -->
  ${snapshot.colors && snapshot.colors.length > 0 ? `
  <div class="section">
    <h2>Farben & Oberflächen</h2>
    <table>
      <thead>
        <tr>
          <th>Farb-ID</th>
          <th>Name</th>
          <th>Typ</th>
          <th>Wert</th>
          <th>Oberfläche</th>
          <th>Anwendung</th>
        </tr>
      </thead>
      <tbody>
        ${snapshot.colors.map(color => `
          <tr class="component-row">
            <td><code>${color.colorId}</code></td>
            <td><strong>${color.name}</strong></td>
            <td>${color.type.toUpperCase()}</td>
            <td><code>${color.value}</code></td>
            <td>${color.finish}</td>
            <td>${color.application}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}
  
  <!-- Production Notes -->
  <div class="section">
    <h2>Produktionshinweise</h2>
    <div class="production-notes">
      <ul>
        ${snapshot.productionNotes.map(note => `<li>${note}</li>`).join('')}
      </ul>
      ${snapshot.assemblyInstructions ? `
        <div style="margin-top: 15px;">
          <strong>Montageanleitung:</strong><br>
          ${snapshot.assemblyInstructions}
        </div>
      ` : ''}
      ${snapshot.qualityChecks && snapshot.qualityChecks.length > 0 ? `
        <div style="margin-top: 15px;">
          <strong>Qualitätsprüfungen:</strong>
          <ul>
            ${snapshot.qualityChecks.map(check => `<li>${check}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <div class="info-grid">
      <div class="info-label">Erstellt am:</div>
      <div class="info-value">${new Date(snapshot.metadata.createdAt).toLocaleString(locale)}</div>
      
      <div class="info-label">Version:</div>
      <div class="info-value">${snapshot.metadata.snapshotVersion}</div>
      
      <div class="info-label">Status:</div>
      <div class="info-value"><strong>GESPERRT</strong> – ${snapshot.metadata.lockReason}</div>
      
      <div class="info-label">Prüfsumme:</div>
      <div class="info-value checksum">${snapshot.metadata.checksumSHA256}</div>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return html;
}

/**
 * Convert HTML to PDF (placeholder – requires PDF library)
 * In production, use puppeteer, playwright, or pdf-lib
 */
export async function convertHTMLToPDF(html: string): Promise<Buffer> {
  // TODO: Implement with puppeteer or pdf-lib
  // For now, return HTML as buffer (development only)
  console.warn('PDF generation not implemented – returning HTML');
  return Buffer.from(html, 'utf-8');
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

/**
 * Export production snapshot
 * 
 * @param snapshot Production snapshot to export
 * @param options Export options
 * @returns Export result with file buffers
 */
export async function exportProductionSnapshot(
  snapshot: ProductionSnapshot,
  options: ProductionExportOptions = { format: 'both' }
): Promise<ProductionExportResult> {
  const result: ProductionExportResult = {
    metadata: {
      exportedAt: new Date().toISOString(),
      snapshotId: snapshot.snapshotId,
      orderId: snapshot.orderId,
      version: '1.0.0',
    },
  };
  
  const baseFilename = `production-${snapshot.snapshotId}`;
  
  // Generate JSON
  if (options.format === 'json' || options.format === 'both') {
    const jsonData = exportAsJSON(snapshot);
    result.json = {
      data: jsonData,
      filename: `${baseFilename}.json`,
      mimeType: 'application/json',
      sizeBytes: Buffer.byteLength(jsonData, 'utf-8'),
    };
  }
  
  // Generate PDF
  if (options.format === 'pdf' || options.format === 'both') {
    const html = generateProductionHTML(snapshot, options);
    const pdfBuffer = await convertHTMLToPDF(html);
    result.pdf = {
      buffer: pdfBuffer,
      filename: `${baseFilename}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: pdfBuffer.length,
    };
  }
  
  return result;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate filename for production export
 */
export function generateExportFilename(
  snapshot: ProductionSnapshot,
  format: 'pdf' | 'json'
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `production-${snapshot.snapshotId}-${timestamp}.${format}`;
}

/**
 * Validate export result
 */
export function validateExportResult(result: ProductionExportResult): boolean {
  if (!result.metadata.snapshotId || !result.metadata.orderId) {
    return false;
  }
  
  if (!result.pdf && !result.json) {
    return false;
  }
  
  return true;
}
