import { AgentChoice } from '../../shared/settings';

export interface GuideStep {
  text: string;
  /** A command to paste into the terminal. */
  command?: string;
  /** A page to open. */
  link?: { label: string; url: string };
}

export interface AgentGuide {
  agent: Exclude<AgentChoice, 'auto'>;
  title: string;
  /** Who this agent is a good choice for. */
  summary: string;
  cost: string;
  steps: GuideStep[];
}

/** Setup instructions written for people who do not use a terminal every day. */
export const AGENT_GUIDES: readonly AgentGuide[] = [
  {
    agent: 'ollama',
    title: 'Ollama',
    summary:
      'Runs an AI model on your own computer. Your text does not leave it. A good first choice.',
    cost: 'Free. Needs a computer with 8 GB of memory or more.',
    steps: [
      {
        text: 'Download Ollama and install it.',
        link: { label: 'ollama.com/download', url: 'https://ollama.com/download' },
      },
      {
        text: 'Download a model. This command gets a small one (about 3 GB). It can take some minutes.',
        command: 'ollama pull gemma3',
      },
      { text: 'Click "Check again", then select ollama as the agent.' },
    ],
  },
  {
    agent: 'claude',
    title: 'Claude Code',
    summary: 'The agent from Anthropic. Very good results, also in languages other than English.',
    cost: 'Needs a paid Claude plan (Pro or Max) or an Anthropic API account.',
    steps: [
      { text: 'Install Claude Code.', command: 'curl -fsSL https://claude.ai/install.sh | bash' },
      {
        text: 'Start it one time and sign in. A browser page opens for that. Then type /exit to close it.',
        command: 'claude',
      },
      { text: 'Click "Check again", then select claude as the agent.' },
    ],
  },
  {
    agent: 'pi',
    title: 'pi',
    summary:
      'A small agent that works with many AI providers. With a free Google Gemini key it costs nothing.',
    cost: 'Free with a Gemini key. Other providers have their own prices.',
    steps: [
      { text: 'Install pi.', command: 'npm install -g @mariozechner/pi-coding-agent' },
      {
        text: 'For the free way: sign in with your Google account and create a Gemini API key.',
        link: { label: 'aistudio.google.com/apikey', url: 'https://aistudio.google.com/apikey' },
      },
      {
        text: 'Sign in to a provider. pi asks which one, then asks for the key or opens a sign-in page.',
        command: 'pi auth login',
      },
      { text: 'Click "Check again", then select pi as the agent.' },
    ],
  },
  {
    agent: 'omp',
    title: 'oh-my-pi (omp)',
    summary: 'A version of pi with more providers. Some of them give free models.',
    cost: 'Depends on the provider you sign in to.',
    steps: [
      {
        text: 'Install omp. The page shows the command for your system.',
        link: { label: 'github.com/can1357/oh-my-pi', url: 'https://github.com/can1357/oh-my-pi' },
      },
      { text: 'Sign in to a provider.', command: 'omp login' },
      {
        text: 'Click "Check again", then select omp as the agent. To use one specific model, put its name in the Model field.',
      },
    ],
  },
];
