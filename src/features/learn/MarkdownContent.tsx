import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="text-[13px] leading-[1.9] wrap-anywhere text-foreground [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_math]:text-[17px] [&_math[display=block]]:text-[22px] [&_ol_li]:list-decimal [&_p]:my-2 [&_strong]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: 'mathml' }]]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
