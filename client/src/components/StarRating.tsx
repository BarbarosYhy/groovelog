import { useState } from 'react';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'text-sm', md: 'text-xl', lg: 'text-2xl' };

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: Props) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className={`flex gap-0.5 ${sizes[size]}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = display >= star;
        const half = !full && display >= star - 0.5;
        return (
          <span key={star} className="relative cursor-default select-none">
            <span className="text-vinyl-border">★</span>
            {(full || half) && (
              <span
                className="absolute inset-0 overflow-hidden text-vinyl-amber"
                style={{ width: half ? '50%' : '100%' }}
              >
                ★
              </span>
            )}
            {!readonly && onChange && (
              <>
                <span
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                  onMouseEnter={() => setHover(star - 0.5)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => onChange(star - 0.5)}
                />
                <span
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => onChange(star)}
                />
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
