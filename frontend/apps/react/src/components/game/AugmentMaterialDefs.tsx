export function AugmentMaterialDefs() {
  // MetaTFT packs the glyph into R; the final material needs a separate black key.
  return <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
    <defs>
      <filter id="kimi-augment-glyph" colorInterpolationFilters="sRGB" x="-25%" y="-25%" width="150%" height="150%">
        <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
      </filter>
      <filter id="kimi-augment-key" colorInterpolationFilters="sRGB" x="-25%" y="-25%" width="150%" height="150%">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  .75 .75 .75 0 0" />
      </filter>
    </defs>
  </svg>
}
