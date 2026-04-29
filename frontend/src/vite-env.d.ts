/// <reference types="vite/client" />

// React JSX namespace for react-markdown compatibility
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
  }
}

// Fix for react-markdown compatibility with React 19 JSX types
declare module "react-markdown" {
  import type { ComponentProps, ReactNode } from "react"

  interface ReactMarkdownProps {
    children?: ReactNode
    className?: string
    components?: Record<string, (props: Record<string, unknown>) => JSX.Element>
    remarkPlugins?: Array<unknown>
    rehypePlugins?: Array<unknown>
    [key: string]: unknown
  }

  export default function ReactMarkdown(props: ReactMarkdownProps): JSX.Element
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DIFY_API_URL: string
  readonly VITE_DIFY_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
