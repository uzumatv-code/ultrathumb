import { describe, expect, it } from 'vitest';
import { ThumbnailWorkflowService } from '../src/modules/generations/thumbnail-workflow.service.js';

describe('ThumbnailWorkflowService', () => {
  const service = new ThumbnailWorkflowService();

  it('returns four CTR-oriented layouts for template mode', () => {
    const result = service.generateTemplateLayouts({
      game: 'Counter-Strike 2',
      videoType: 'highlight',
      emotion: 'agressivo',
      mainObject: 'AK-47',
      text: 'CLUTCH INSANO',
      dominantColor: 'laranja',
      facecamStyle: 'neon',
    });

    expect(result.layouts).toHaveLength(4);
    expect(result.layouts.map((layout) => layout.id)).toEqual([
      'hero-weapon-push',
      'enemy-lock-center',
      'reaction-split-proof',
      'clean-map-callout',
    ]);
  });

  it('builds one prompt per selected layout with anti-poster-art guardrails', () => {
    const prompts = service.buildTemplateModePrompts({
      input: {
        game: 'Counter-Strike 2',
        videoType: 'highlight',
        emotion: 'agressivo',
        mainObject: 'AK-47',
        text: 'CLUTCH INSANO',
        dominantColor: 'laranja',
        facecamStyle: 'neon',
      },
      selectedLayoutIds: ['hero-weapon-push', 'clean-map-callout'],
      styleConfig: {
        visualStyle: 'gamer',
      },
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[0]?.finalPrompt).toContain('avoid generic poster art');
    expect(prompts[1]?.finalPrompt).toContain('highly clickable');
  });
});
