// Parse a JSON array object by object without allocating the complete API response.
// This runs in a worker so the global photo index cannot block scrolling and input.
export class JsonArrayStream {
  private phase: 'start' | 'value' | 'requiredValue' | 'object' | 'separator' | 'end' = 'start';
  private depth = 0;
  private inString = false;
  private escaped = false;
  private part = '';
  constructor(private onObject: (value: any) => void) {}

  push(text: string): void {
    for (const char of text) {
      if (this.phase === 'object') {
        this.part += char;
        if (this.part.length > 4 * 1024 * 1024) throw new Error('Une fiche photo est trop volumineuse.');
        if (this.inString) {
          if (this.escaped) this.escaped = false;
          else if (char === '\\') this.escaped = true;
          else if (char === '"') this.inString = false;
        } else if (char === '"') this.inString = true;
        else if (char === '{') this.depth++;
        else if (char === '}' && --this.depth === 0) {
          this.onObject(JSON.parse(this.part)); this.part = ''; this.phase = 'separator';
        }
        continue;
      }
      if (/\s/.test(char)) continue;
      if (this.phase === 'start' && char === '[') { this.phase = 'value'; continue; }
      if ((this.phase === 'value' || this.phase === 'requiredValue') && char === '{') {
        this.phase = 'object'; this.depth = 1; this.part = '{'; continue;
      }
      if ((this.phase === 'value' || this.phase === 'separator') && char === ']') { this.phase = 'end'; continue; }
      if (this.phase === 'separator' && char === ',') { this.phase = 'requiredValue'; continue; }
      throw new Error('La liste des photos est invalide.');
    }
  }

  finish(): void {
    if (this.phase !== 'end') throw new Error('Le chargement des photos a été interrompu. Réessayez.');
  }
}
