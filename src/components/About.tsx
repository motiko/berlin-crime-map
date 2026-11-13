import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function About({ open, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="about" onClose={onClose} aria-labelledby="about-title">
      <h2 id="about-title">About this map</h2>
      <p>
        This map shows the press releases of the Berlin police (
        <a href="https://www.berlin.de/polizei/polizeimeldungen/" target="_blank" rel="noreferrer">
          Polizeimeldungen
        </a>
        ). A new batch is collected every morning.
      </p>
      <h3>How it works</h3>
      <ul>
        <li>An AI model reads each German report and records the category, the street, the date and a short English summary.</li>
        <li>Streets are placed with OpenStreetMap geocoding. Hollow dots sit at a district centre because the report names no street.</li>
        <li>Each entry links to the original report. The full text is not copied here.</li>
        <li>
          For recent shootings, killings, knife attacks and explosions, a web search finds news articles about the incident, and the AI
          checks that each one is about the same event. Linked articles are the outlets' own reporting: they may name the people
          involved, and some are paywalled.
        </li>
      </ul>
      <h3>Keep in mind</h3>
      <ul>
        <li>
          Press releases are a <strong>selection</strong> the police choose to publish, not all crime. Counts here are not crime statistics.
        </li>
        <li>The AI can misread a report or misplace it. The original report is always the authority.</li>
        <li>Summaries leave out names and descriptions of people.</li>
      </ul>
      <form method="dialog">
        <button type="submit" className="primary">
          Close
        </button>
      </form>
    </dialog>
  );
}
