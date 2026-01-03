/**
 * Example DesignPayload Configurations
 * 
 * These represent 3 different customer configurations to demonstrate
 * the schema in action.
 */

export const EXAMPLE_WINE_GLASS_HOLDER = {
  version: 'design.v1',
  designId: 'e4c7a8b2-9d3f-4e5a-8b7c-2d1e9f6a3b4c',
  productKey: 'UNBREAK-WEIN-01',
  createdAt: '2026-01-03T10:30:00.000Z',
  updatedAt: '2026-01-03T10:35:00.000Z',
  locale: 'de-DE',
  currency: 'EUR',
  
  selections: {
    variant: 'wine_glass_holder',
    size: 'standard',
    material: 'steel',
    finish: 'matte',
    options: {
      engraving: true,
      giftBox: false
    }
  },
  
  bom: [
    {
      componentId: 'base-plate',
      componentName: 'Grundplatte',
      materialId: 'steel-304',
      color: {
        system: 'RAL',
        code: 'RAL 7016',
        label: 'Anthrazitgrau'
      },
      qty: 1,
      unit: 'pcs',
      dimensions: {
        length: 150,
        width: 150,
        height: 3,
        unit: 'mm'
      }
    },
    {
      componentId: 'glass-holder',
      componentName: 'Glashalter',
      materialId: 'steel-304',
      color: {
        system: 'RAL',
        code: 'RAL 7016',
        label: 'Anthrazitgrau'
      },
      qty: 1,
      unit: 'pcs',
      dimensions: {
        diameter: 85,
        height: 120,
        unit: 'mm'
      }
    },
    {
      componentId: 'engraving',
      componentName: 'Lasergravur',
      qty: 1,
      unit: 'pcs',
      notes: 'Text: "CHEERS 2026"'
    }
  ],
  
  previews: {
    thumbPngBase64: null, // Would be actual base64 in production
    shopPngBase64: null,
    glbUrl: 'https://storage.example.com/designs/e4c7a8b2.glb',
    snapshotAngle: {
      yaw: 45,
      pitch: 30,
      zoom: 1.2
    }
  },
  
  sceneState: {
    camera: {
      position: { x: 2, y: 1.5, z: 3 },
      target: { x: 0, y: 0.5, z: 0 }
    },
    materials: {
      'base-plate': { colorCode: 'RAL 7016', finish: 'matte' },
      'glass-holder': { colorCode: 'RAL 7016', finish: 'matte' }
    },
    engraving: {
      text: 'CHEERS 2026',
      font: 'Arial',
      depth: 0.5,
      position: { x: 0, y: 10, z: 0 }
    }
  },
  
  validation: {
    isValid: true,
    issues: []
  },
  
  userText: {
    engraving: 'CHEERS 2026',
    noteToMaker: null
  }
};

export const EXAMPLE_BOTTLE_HOLDER_CUSTOM_COLOR = {
  version: 'design.v1',
  designId: 'f8d2b3c4-1e5f-4a6b-9c8d-3e2f0a7b4d5e',
  productKey: 'UNBREAK-FLASCHE-01',
  createdAt: '2026-01-03T11:00:00.000Z',
  updatedAt: '2026-01-03T11:15:00.000Z',
  locale: 'de-DE',
  currency: 'EUR',
  
  selections: {
    variant: 'bottle_holder',
    size: 'large',
    material: 'steel',
    finish: 'glossy',
    options: {
      customColor: true,
      engraving: false,
      giftBox: true
    }
  },
  
  bom: [
    {
      componentId: 'base-plate',
      componentName: 'Grundplatte',
      materialId: 'steel-304',
      color: {
        system: 'HEX',
        code: '#006B5C',
        label: 'Petrol (Custom)'
      },
      qty: 1,
      unit: 'pcs',
      dimensions: {
        length: 200,
        width: 200,
        height: 3,
        unit: 'mm'
      }
    },
    {
      componentId: 'bottle-holder',
      componentName: 'Flaschenhalter',
      materialId: 'steel-304',
      color: {
        system: 'HEX',
        code: '#006B5C',
        label: 'Petrol (Custom)'
      },
      qty: 1,
      unit: 'pcs',
      dimensions: {
        diameter: 95,
        height: 250,
        unit: 'mm'
      }
    },
    {
      componentId: 'gift-box',
      componentName: 'Geschenkbox',
      materialId: 'cardboard',
      qty: 1,
      unit: 'pcs'
    }
  ],
  
  previews: {
    thumbPngBase64: null,
    shopPngBase64: null,
    glbUrl: 'https://storage.example.com/designs/f8d2b3c4.glb',
    snapshotAngle: {
      yaw: 60,
      pitch: 25,
      zoom: 1.0
    }
  },
  
  sceneState: {
    camera: {
      position: { x: 3, y: 2, z: 4 },
      target: { x: 0, y: 1, z: 0 }
    },
    materials: {
      'base-plate': { colorHex: '#006B5C', finish: 'glossy' },
      'bottle-holder': { colorHex: '#006B5C', finish: 'glossy' }
    }
  },
  
  validation: {
    isValid: true,
    issues: []
  },
  
  userText: {
    noteToMaker: 'Bitte extra sorgfältig verpacken - ist ein Geschenk!'
  }
};

export const EXAMPLE_GASTRO_EDITION_INVALID = {
  version: 'design.v1',
  designId: 'a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6',
  productKey: 'UNBREAK-GASTRO-01',
  createdAt: '2026-01-03T12:00:00.000Z',
  updatedAt: '2026-01-03T12:05:00.000Z',
  locale: 'de-DE',
  currency: 'EUR',
  
  selections: {
    variant: 'gastro_edition',
    size: 'set-of-6',
    material: 'steel',
    finish: 'matte',
    options: {
      logo: true,
      customColors: false
    }
  },
  
  bom: [
    {
      componentId: 'glass-holder-set',
      componentName: 'Glashalter Set (6 Stück)',
      materialId: 'steel-304',
      color: {
        system: 'RAL',
        code: 'RAL 9005',
        label: 'Tiefschwarz'
      },
      qty: 6,
      unit: 'pcs'
    },
    {
      componentId: 'logo-engraving',
      componentName: 'Logo-Gravur',
      qty: 6,
      unit: 'pcs',
      notes: 'Logo file missing!' // This causes validation error
    }
  ],
  
  previews: {
    thumbPngBase64: null,
    shopPngBase64: null,
    glbUrl: null, // Missing 3D model
    snapshotAngle: {
      yaw: 0,
      pitch: 0,
      zoom: 1.0
    }
  },
  
  sceneState: {
    camera: {
      position: { x: 0, y: 2, z: 5 },
      target: { x: 0, y: 0, z: 0 }
    },
    materials: {
      'glass-holder-set': { colorCode: 'RAL 9005', finish: 'matte' }
    },
    logo: null // Missing logo data
  },
  
  validation: {
    isValid: false,
    issues: [
      {
        code: 'MISSING_LOGO_FILE',
        message: 'Logo-Datei wurde nicht hochgeladen',
        severity: 'error'
      },
      {
        code: 'MISSING_3D_MODEL',
        message: '3D-Modell konnte nicht generiert werden',
        severity: 'warning'
      }
    ]
  },
  
  userText: {
    noteToMaker: 'Logo wird noch nachgeliefert - bitte warten mit Produktion'
  }
};
