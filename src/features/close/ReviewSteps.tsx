const steps = [
  { label: 'Overview', path: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { label: 'Outcomes', path: 'm6 12 4 4 8-9M12 3a9 9 0 1 0 9 9' },
  { label: 'Tasks', path: 'm3 6 1.5 1.5L7 4M11 6h10M3 12h4M11 12h10M3 18h4M11 18h10' },
  { label: 'Retrospective', path: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 9h10M7 13h6' },
  { label: 'Review', path: 'M6 3h9l4 4v14H6ZM14 3v5h5m-9 6 2 2 4-4' },
];

export function ReviewSteps({ step, onChange }: { step: number; onChange: (step: number) => void }) {
  return <nav aria-label="Sprint Close progress" className="focus-flow__close-steps">
    {steps.map(({ label, path }, index) => <button aria-current={step === index ? 'step' : undefined} key={label} onClick={() => onChange(index)} type="button">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label}
    </button>)}
  </nav>;
}
