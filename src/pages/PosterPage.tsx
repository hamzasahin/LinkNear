import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function PosterPage() {
  const [community, setCommunity] = useState('')

  const title = community.trim()
    ? `LinkNear at ${community.trim()}`
    : 'LinkNear'

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: #F5F0EB !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .poster {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 40mm 25mm;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#F5F0EB' }}>
        {/* Poster */}
        <div
          className="poster w-full max-w-[210mm] bg-white flex flex-col items-center justify-center text-center px-12 py-16 md:px-20 md:py-24"
          style={{
            backgroundColor: '#F5F0EB',
            aspectRatio: '210 / 297',
            border: '2px solid #D4654A',
          }}
        >
          {/* Label */}
          <p
            className="font-pixel text-xs uppercase tracking-[0.2em] mb-3"
            style={{ color: '#D4654A' }}
          >
            Connect locally
          </p>

          {/* Title */}
          <h1
            className="font-display text-5xl md:text-7xl leading-[1.05] mb-4"
            style={{ color: '#3d3733' }}
          >
            {title}
          </h1>

          {/* Tagline */}
          <p
            className="text-lg md:text-xl mb-12"
            style={{ color: '#706a64', fontFamily: 'var(--font-sans)' }}
          >
            Meet brilliant people nearby.
          </p>

          {/* QR Code container */}
          <div
            className="flex flex-col items-center rounded-xl p-8 mb-12"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #eae3dd' }}
          >
            <QRCodeSVG
              value="https://linknear.vercel.app"
              size={220}
              level="H"
              fgColor="#3d3733"
              bgColor="#FFFFFF"
              includeMargin={false}
            />
            <p
              className="font-pixel text-xs mt-5 tracking-wide"
              style={{ color: '#706a64' }}
            >
              linknear.vercel.app
            </p>
          </div>

          {/* Value props */}
          <div className="space-y-2 text-base md:text-lg" style={{ color: '#494440' }}>
            <p>No photos until you connect.</p>
            <p>Daily challenges from timeless wisdom.</p>
            <p style={{ color: '#D4654A', fontWeight: 500 }}>Character first.</p>
          </div>
        </div>

        {/* Controls — hidden when printing */}
        <div className="no-print mt-10 flex flex-col items-center gap-4 w-full max-w-md">
          <label className="w-full">
            <span
              className="font-pixel text-xs uppercase tracking-[0.15em] block mb-2"
              style={{ color: '#706a64' }}
            >
              Community name (optional)
            </span>
            <input
              type="text"
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              placeholder="e.g. SJSU, WeWork Downtown, Hacker House"
              className="w-full px-4 py-3 rounded-lg text-base outline-none transition-colors"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #eae3dd',
                color: '#3d3733',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </label>

          <button
            onClick={() => window.print()}
            className="w-full py-3 rounded-lg text-white font-medium text-base cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#D4654A' }}
          >
            Print this poster
          </button>
        </div>
      </div>
    </>
  )
}
