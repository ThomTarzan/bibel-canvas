import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="icon">
      {children}
    </svg>
  );
}

export function IconUndo() {
  return (
    <Svg>
      <path d="M6.2 4.2 3.2 7.2l3 3" />
      <path d="M3.6 7.2H9a3.4 3.4 0 1 1 0 6.8H8" />
    </Svg>
  );
}

export function IconRedo() {
  return (
    <Svg>
      <path d="M9.8 4.2 12.8 7.2l-3 3" />
      <path d="M12.4 7.2H7a3.4 3.4 0 1 0 0 6.8H8" />
    </Svg>
  );
}

export function IconMinus() {
  return (
    <Svg>
      <path d="M3.5 8h9" />
    </Svg>
  );
}

export function IconPlus() {
  return (
    <Svg>
      <path d="M8 3.5v9M3.5 8h9" />
    </Svg>
  );
}
