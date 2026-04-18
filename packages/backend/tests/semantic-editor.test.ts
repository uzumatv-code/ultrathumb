import { describe, expect, it } from 'vitest';
import { parseSemanticCommand } from '../src/modules/semantic-editor/semantic-editor.service.js';

describe('parseSemanticCommand', () => {
  it('detects weapon scale and CS-style authenticity requests', () => {
    const draft = parseSemanticCommand(
      'generation-1',
      'variant-1',
      'deixa a arma maior e deixa mais parecido com CS',
    );

    expect(draft.normalizedRequest.change.heroObject).toBe('bigger');
    expect(draft.normalizedRequest.change.objectFocus).toBe('increase');
    expect(draft.normalizedRequest.change.mapStyle).toBe('more_authentic');
    expect(draft.promptDelta).toContain('make the main weapon larger');
  });

  it('detects anti-neon and realism refinements from short prompts', () => {
    const draft = parseSemanticCommand(
      'generation-1',
      'variant-1',
      'remove excesso de neon e deixa menos artificial',
    );

    expect(draft.normalizedRequest.change.glowIntensity).toBe('lower');
    expect(draft.normalizedRequest.change.realism).toBe('less_artificial');
    expect(draft.normalizedRequest.change.styleDirective).toBe('more_clean');
    expect(draft.promptDelta).toContain('reduce neon excess and clean the finish');
  });
});
