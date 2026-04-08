// Ink için minimal tip tanımı
// Bu dosya, TypeScript derleyicisinin "ink" modülünü bulamama
// hatasını çözmek için oluşturulmuştur. Gerçek tipler daha zengin
// olsa da, MVP için temel kullanım senaryolarını karşılayacak
// kadar yüzey tanımlıyoruz.

declare module "ink" {
  import * as React from "react";

  export interface BoxProps {
    children?: React.ReactNode;
    // Ink'in gerçek prop yüzeyi çok daha geniş;
    // burada sadece en sık kullanılanlarını gevşek
    // tiplerle temsil ediyoruz.
    flexDirection?: "row" | "column";
    marginTop?: number;
  }

  export interface TextProps {
    children?: React.ReactNode;
    color?: string;
    wrap?: "truncate" | "truncate-start" | "truncate-center" | "truncate-end";
  }

  export const Box: React.ComponentType<BoxProps>;
  export const Text: React.ComponentType<TextProps>;

  export interface UseAppApi {
    exit: () => void;
  }

  export function useApp(): UseAppApi;

  export interface Key {
    return?: boolean;
    escape?: boolean;
    backspace?: boolean;
    delete?: boolean;
    // Diğer özel tuşlar gerektiğinde eklenebilir
    [key: string]: any;
  }

  export function useInput(
    handler: (input: string, key: Key) => void
  ): void;

  export interface RenderInstance {
    waitUntilExit: () => Promise<void>;
  }

  export function render(
    node: React.ReactElement
  ): RenderInstance;
}

