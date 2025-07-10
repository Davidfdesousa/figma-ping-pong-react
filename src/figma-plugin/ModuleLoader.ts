// ModuleLoader.ts

interface ModuleRecord {
  dependencies: string[];
  factory: (...args: any[]) => any;
  exports: any | null;
}

const modules: Record<string, ModuleRecord> = {};

/**
 * Define a module no loader.
 * @param name Nome único do módulo.
 * @param dependencies Lista de nomes de módulos dos quais este depende.
 * @param factory Função que será executada para criar o módulo.
 */
export function define(
  name: string,
  dependencies: string[],
  factory: (...args: any[]) => any
): void {
  modules[name] = { dependencies, factory, exports: null };
}

/**
 * Requer (importa) um módulo definido.
 * @param name Nome do módulo a importar.
 * @returns O objeto exportado pelo módulo.
 */
export function require(name: string): any {
  const mod = modules[name];
  if (!mod) {
    throw new Error(`Module ${name} not found`);
  }
  if (mod.exports !== null) {
    return mod.exports;
  }
  const args = mod.dependencies.map(dep => {
    if (dep === 'figma') {
      return (globalThis as any).figma;
    }
    return require(dep);
  });
  const result = mod.factory(...args);
  mod.exports = result;
  return result;
}
