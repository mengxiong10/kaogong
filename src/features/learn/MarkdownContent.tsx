import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function assetUrl(value?: string) {
  if (!value) return undefined;
  return value.startsWith('/content/')
    ? `${import.meta.env.BASE_URL}${value.slice(1)}`
    : value;
}

const image = ({ src, alt }: { src?: string; alt?: string }) => (
  <img
    src={assetUrl(src)}
    alt={alt ?? ''}
    className="my-3 h-auto max-w-none"
    loading="lazy"
  />
);

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="overflow-x-auto text-[13px] leading-[1.9] wrap-anywhere text-foreground [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_math]:text-[17px] [&_math[display=block]]:text-[22px] [&_ol_li]:list-decimal [&_p]:my-2 [&_strong]:font-semibold">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: 'mathml' }]]}
        components={{ img: image }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function InlineMarkdownContent({ children }: { children: string }) {
  return (
    <span className="min-w-0 text-left wrap-anywhere [&_img]:inline-block [&_img]:max-w-full [&_img]:align-middle">
      <ReactMarkdown
        components={{
          p: ({ children }) => <span>{children}</span>,
          img: image,
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}
