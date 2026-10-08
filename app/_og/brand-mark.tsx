// The symbol from public/brand/logo.svg: its first two paths (the "Steel"
// lettering is the third). viewBox cropped to the symbol's bounding box.
export function BrandMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 228 235'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M45.9414 156.667L0 78.3333L45.9414 0H226.743L182.495 78.3333H92.0946L45.9414 156.667Z'
        fill='#F1F0EB'
      />
      <path
        d='M181.649 78.3333L227.59 156.667L181.649 235H0.846848L45.0946 156.667H135.495L181.649 78.3333Z'
        fill='#F1F0EB'
      />
    </svg>
  )
}
