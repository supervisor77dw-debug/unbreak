/**
 * ProductImage - Zentrale Komponente für einheitliche Produktbild-Darstellung
 * 
 * Verwendet in:
 * - Shop Produktkarten (4:3)
 * - Admin Produktliste (1:1)
 * - Admin Produkt bearbeiten (4:3)
 * 
 * Props:
 * - src: Bild-URL
 * - alt: Alt-Text
 * - aspect: "4/3" | "1/1" (Seitenverhältnis)
 * - fit: "cover" | "contain" (default: "cover")
 * - position: "X% Y%" (default: "50% 50%")
 * - className: Optionale CSS-Klasse für Wrapper
 * - onLoad: Callback wenn Bild geladen
 * - onError: Callback bei Fehler
 */

export default function ProductImage({
  src,
  alt = 'Produktbild',
  aspect = '4/3',
  fit = 'cover',
  position = '50% 50%',
  className = '',
  onLoad,
  onError,
}) {
  return (
    <div className={`product-image-wrapper ${className}`}>
      <img
        src={src}
        alt={alt}
        onLoad={onLoad}
        onError={onError}
        loading="lazy"
      />
      
      <style jsx>{`
        .product-image-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: ${aspect};
          overflow: hidden;
          background: #222;
          border-radius: 8px;
        }

        .product-image-wrapper img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: ${fit};
          object-position: ${position};
          display: block;
        }
      `}</style>
    </div>
  );
}
