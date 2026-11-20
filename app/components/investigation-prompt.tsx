import { TypingAnimation } from './typing-animation';

export function InvestigationPrompt() {
  return <div className="t-investigation-prompt" data-reveal>
    <h2><TypingAnimation duration={65}>Where did this run go wrong?</TypingAnimation></h2>
  </div>;
}
