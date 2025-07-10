// utils.ts
import { define } from '../ModuleLoader';

/**
 * Representa um valor de cor no formato do Figma,
 * com componentes normalizados entre 0 e 1.
 */
interface ColorValue {
  r: number;
  g: number;
  b: number;
}

/**
 * Tipos de token que definem como formatar o valor:
 * - 'COLOR': valor é um objeto ColorValue
 * - 'FLOAT': valor numérico que deve receber 'px'
 * - 'STRING': valor textual
 * - string genérico para extensões futuras
 */
type TokenType = 'COLOR' | 'FLOAT' | 'STRING' | string;

/**
 * Interface com todas as funções utilitárias expostas.
 */
export interface Utils {
  /**
   * Converte uma string qualquer em Base64.
   * Usa mapeamento manual de bits e adiciona padding correto.
   * @param str - Texto a ser convertido
   * @returns Base64 da string
   */
  stringToBase64(str: string): string;

  /**
   * Formata um valor de token de acordo com seu tipo:
   * - COLOR: transforma objeto {r,g,b} em hex '#RRGGBB'
   * - FLOAT: adiciona sufixo 'px'
   * - STRING: retorna o valor textual
   * - Outros: retorna valor sem alteração
   * @param value - Valor bruto do token
   * @param type  - Tipo do token
   * @returns Valor formatado
   */
  formatTokenValue(value: any, type: TokenType): any;

  /**
   * Converte um nome de token, possivelmente com
   * separadores '/' ou '-', em um array de path.
   * Exemplo: 'color/brand-primary' → ['color','brand','primary']
   * @param tokenName - Nome original do token
   * @returns Array de segmentos de path
   */
  parseTokenPath(tokenName: string): string[];

  /**
   * Define um valor aninhado em um objeto arbitrário,
   * criando sub-objetos conforme necessário.
   * Exemplo:
   *   setNestedValue(obj, ['a','b','c'], 123)
   *   // obj = { a: { b: { c: 123 } } }
   * @param obj   - Objeto raiz
   * @param path  - Array de chaves sequenciais
   * @param value - Valor a ser atribuído
   */
  setNestedValue(obj: Record<string, any>, path: string[], value: any): void;
}

define('utils', [], function(): Utils {
  function stringToBase64(str: string): string {
    // Tabela de caracteres Base64
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;

    // Processa 3 bytes de cada vez
    while (i < str.length) {
      const a = str.charCodeAt(i++);
      const b = i < str.length ? str.charCodeAt(i++) : 0;
      const c = i < str.length ? str.charCodeAt(i++) : 0;

      // Junta os 3 bytes em um inteiro de 24 bits
      const bitmap = (a << 16) | (b << 8) | c;

      // Extrai 4 sextetos de 6 bits e converte para caracteres
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += chars.charAt((bitmap >> 6) & 63);
      result += chars.charAt(bitmap & 63);
    }

    // Adiciona '=' para completar múltiplos de 4
    const padding = str.length % 3;
    if (padding === 1) {
      result = result.slice(0, -2) + '==';
    } else if (padding === 2) {
      result = result.slice(0, -1) + '=';
    }

    return result;
  }

  function formatTokenValue(value: any, type: TokenType): any {
    // Se for cor, converte de decimal [0,1] para hex
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
    }
    // Se for número float, adiciona 'px'
    else if (type === 'FLOAT') {
      return `${value}px`;
    }
    // Se for string, retorna diretamente
    else if (type === 'STRING') {
      return value;
    }
    // Outros tipos, retorna sem alteração
    return value;
  }

  function parseTokenPath(tokenName: string): string[] {
    // Substitui '/' e '-' por '.' e quebra em array
    return tokenName
      .replace(/[\/\-]/g, '.')
      .split('.')
      .map(part => part.trim())      // remove espaços
      .filter(part => part.length > 0); // elimina strings vazias
  }

  function setNestedValue(obj: Record<string, any>, path: string[], value: any): void {
    let current: any = obj;
    // Percorre todas as chaves, exceto a última
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      // Cria um objeto se não existir
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    // Atribui valor na última chave
    current[path[path.length - 1]] = value;
  }

  return { stringToBase64, formatTokenValue, parseTokenPath, setNestedValue };
});
