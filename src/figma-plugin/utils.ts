// utils.ts
import { define } from './ModuleLoader';

/** Estrutura para valores de cor normalizados pelo Figma. */
interface ColorValue {
  r: number;
  g: number;
  b: number;
}

/** Tipos possíveis de token. */
type TokenType = 'COLOR' | 'FLOAT' | 'STRING' | string;

/** Interface geral dos utilitários expostos. */
export interface Utils {
  stringToBase64(str: string): string;
  formatTokenValue(value: any, type: TokenType): any;
  parseTokenPath(tokenName: string): string[];
  setNestedValue(obj: Record<string, any>, path: string[], value: any): void;
}

define('utils', [], function(): Utils {
  function stringToBase64(str: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = i < str.length ? str.charCodeAt(i++) : 0;
      const c = i < str.length ? str.charCodeAt(i++) : 0;
      const bitmap = (a << 16) | (b << 8) | c;
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += chars.charAt((bitmap >> 6) & 63);
      result += chars.charAt(bitmap & 63);
    }
    const padding = str.length % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + '==';
    } else if (padding === 2) {
      result = result.slice(0, -1) + '=';
    }
    return result;
  }

  function formatTokenValue(value: any, type: TokenType): any {
    if (type === 'COLOR' && typeof value === 'object' && value !== null && 'r' in value) {
      const { r, g, b } = value as ColorValue;
      const red = Math.round(r * 255);
      const green = Math.round(g * 255);
      const blue = Math.round(b * 255);
      return (
        '#' +
        red.toString(16).padStart(2, '0') +
        green.toString(16).padStart(2, '0') +
        blue.toString(16).padStart(2, '0')
      ).toUpperCase();
    } else if (type === 'FLOAT') {
      return `${value}px`;
    } else if (type === 'STRING') {
      return value;
    }
    return value;
  }

  function parseTokenPath(tokenName: string): string[] {
    return tokenName
      .replace(/[\/\-]/g, '.')
      .split('.')
      .map(part => part.trim())
      .filter(part => part.length > 0);
  }

  function setNestedValue(obj: Record<string, any>, path: string[], value: any): void {
    let current: any = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[path[path.length - 1]] = value;
  }

  return { stringToBase64, formatTokenValue, parseTokenPath, setNestedValue };
});
