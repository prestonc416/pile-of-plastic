/** A brand and how many catalog figures it has. */
export interface BrandOption {
  name: string
  count: number
}

interface BrandPickerProps {
  brands: BrandOption[]
  /** Total figures in the catalog, shown on the "All brands" box. */
  total: number
  /** The selected brand, or '' for all brands. */
  selected: string
  onSelect: (brand: string) => void
}

function countLabel(count: number): string {
  return count === 1 ? '1 figure' : `${count} figures`
}

/**
 * A grid of clickable boxes for filtering the catalog by brand, with
 * "All brands" first. Each box is a toggle button: aria-pressed tells
 * screen readers which one is on. Clicking the selected brand again goes
 * back to all brands.
 */
export default function BrandPicker({ brands, total, selected, onSelect }: BrandPickerProps) {
  return (
    <fieldset className="brand-picker">
      <legend className="field-label">Brand</legend>
      <div className="brand-grid">
        <button
          type="button"
          className="brand-box"
          aria-pressed={selected === ''}
          onClick={() => onSelect('')}
        >
          <span className="brand-name">All brands</span>
          <span className="brand-count">{countLabel(total)}</span>
        </button>
        {brands.map((brand) => (
          <button
            key={brand.name}
            type="button"
            className="brand-box"
            aria-pressed={selected === brand.name}
            onClick={() => onSelect(selected === brand.name ? '' : brand.name)}
          >
            <span className="brand-name">{brand.name}</span>
            <span className="brand-count">{countLabel(brand.count)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
