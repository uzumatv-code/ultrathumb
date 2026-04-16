// =============================================================================
// ThumbForge AI — Database Seed
// =============================================================================

import '../src/shared/utils/loadEnv.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ThumbForge AI database...');

  // ─── Feature Flags ──────────────────────────────────────────────────────────
  const featureFlags = [
    { key: 'trial_enabled', value: 'true', description: 'Habilita trial gratuito para novos usuários' },
    { key: 'trial_generations', value: '3', description: 'Quantidade de gerações gratuitas no trial' },
    { key: 'email_verification_required', value: 'false', description: 'Exige verificação de email' },
    { key: 'referral_enabled', value: 'true', description: 'Sistema de referral ativo' },
    { key: 'referral_bonus_generations', value: '1', description: 'Gerações bonus por referral' },
    { key: 'pix_enabled', value: 'true', description: 'Pagamento via PIX habilitado' },
    { key: 'credit_card_enabled', value: 'false', description: 'Cartão de crédito habilitado' },
    { key: 'boleto_enabled', value: 'false', description: 'Boleto habilitado' },
    { key: 'installments_enabled', value: 'false', description: 'Parcelamento habilitado' },
    { key: 'max_installments', value: '12', description: 'Número máximo de parcelas' },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: { ...flag, isEnabled: true },
    });
  }
  console.log(`✅ ${featureFlags.length} feature flags criadas`);

  // ─── System Settings ────────────────────────────────────────────────────────
  const settings = [
    // Pricing
    { category: 'pricing', key: 'plan_price_cents', value: '4990', valueType: 'number', description: 'Preço mensal do plano em centavos' },
    { category: 'pricing', key: 'single_thumb_price_cents', value: '1990', valueType: 'number', description: 'Preço unitário de thumbnail em centavos' },
    { category: 'pricing', key: 'combo_price_cents', value: '4000', valueType: 'number', description: 'Preço do combo (3 thumbs) em centavos' },
    // Preview
    { category: 'preview', key: 'width', value: '480', valueType: 'number', description: 'Largura do preview em pixels' },
    { category: 'preview', key: 'height', value: '270', valueType: 'number', description: 'Altura do preview em pixels' },
    { category: 'preview', key: 'blur', value: '2', valueType: 'number', description: 'Intensidade do blur no preview' },
    { category: 'preview', key: 'watermark_text', value: 'THUMBFORGE PREVIEW', valueType: 'string', description: 'Texto da watermark' },
    { category: 'preview', key: 'watermark_opacity', value: '0.4', valueType: 'number', description: 'Opacidade da watermark (0-1)' },
    { category: 'preview', key: 'token_expires_minutes', value: '60', valueType: 'number', description: 'Expiração do token de preview em minutos' },
    // Downloads
    { category: 'downloads', key: 'url_expires_minutes', value: '15', valueType: 'number', description: 'Expiração da URL de download em minutos' },
    { category: 'downloads', key: 'retention_days', value: '90', valueType: 'number', description: 'Dias de retenção de arquivos após pagamento' },
    // AI
    { category: 'ai', key: 'generation_timeout_ms', value: '120000', valueType: 'number', description: 'Timeout de geração de IA em ms' },
    { category: 'ai', key: 'max_retries', value: '3', valueType: 'number', description: 'Máximo de retries de geração' },
    { category: 'ai', key: 'variants_count', value: '3', valueType: 'number', description: 'Número de variantes geradas por request' },
    // Output
    { category: 'output', key: 'hd_width', value: '1280', valueType: 'number', description: 'Largura do arquivo HD em pixels' },
    { category: 'output', key: 'hd_height', value: '720', valueType: 'number', description: 'Altura do arquivo HD em pixels' },
    // Email
    { category: 'email', key: 'from_name', value: 'ThumbForge AI', valueType: 'string', description: 'Nome do remetente de email' },
    { category: 'email', key: 'from_address', value: 'noreply@thumbforge.com', valueType: 'string', description: 'Email remetente' },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { category_key: { category: setting.category, key: setting.key } },
      update: {},
      create: { ...setting, isSecret: false },
    });
  }
  console.log(`✅ ${settings.length} configurações do sistema criadas`);

  // ─── Plans ──────────────────────────────────────────────────────────────────
  const starterPlan = await prisma.plan.upsert({
    where: { id: 'plan-starter-v1' },
    update: {},
    create: {
      id: 'plan-starter-v1',
      name: 'Creator',
      description: 'Para criadores que geram thumbnails regularmente',
      priceCents: 4990,
      generationsLimit: 30,
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
      features: JSON.stringify([
        '30 gerações por mês',
        '3 variações por geração',
        'Todos os templates',
        'Suporte via chat',
        'Biblioteca de modelos salvos',
        'Histórico de gerações',
      ]),
    },
  });
  console.log(`✅ Plano criado: ${starterPlan.name}`);

  // ─── Templates ──────────────────────────────────────────────────────────────
  const templates = [
    {
      id: 'tpl-gamer-fps',
      name: 'FPS Gamer',
      description: 'Estilo agressivo e dinâmico para jogos FPS como CS2, Valorant, Apex',
      category: 'GAMER_FPS' as const,
      isPremium: false,
      sortOrder: 1,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 80,
        glowColor: '#ff4400',
        visualStyle: 'gamer',
        textPosition: 'bottom-left',
        fontColor: '#ffffff',
        fontOutlineColor: '#000000',
        fontOutlineWidth: 3,
      }),
      defaultPromptHints: 'High contrast, explosive action, neon accents, dark background, intense lighting',
      tags: JSON.stringify(['fps', 'gamer', 'cs2', 'valorant', 'apex', 'action']),
      recommendedFonts: JSON.stringify(['Oswald', 'Bebas Neue', 'Impact', 'Rajdhani']),
    },
    {
      id: 'tpl-battle-royale',
      name: 'Battle Royale',
      description: 'Thumbnails épicas para Fortnite, PUBG, Free Fire',
      category: 'BATTLE_ROYALE' as const,
      isPremium: false,
      sortOrder: 2,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 70,
        glowColor: '#ffd700',
        visualStyle: 'high-energy',
        textPosition: 'top-right',
        fontColor: '#ffffff',
        fontOutlineColor: '#8b0000',
        fontOutlineWidth: 4,
      }),
      defaultPromptHints: 'Epic scene, squad formation, parachuting, victory royale feel, dramatic sky',
      tags: JSON.stringify(['battle-royale', 'fortnite', 'pubg', 'free-fire', 'squad']),
      recommendedFonts: JSON.stringify(['Bangers', 'Black Ops One', 'Boogaloo']),
    },
    {
      id: 'tpl-mobile-game',
      name: 'Mobile Game',
      description: 'Colorido e chamativo para jogos mobile e conteúdo casual',
      category: 'MOBILE_GAME' as const,
      isPremium: false,
      sortOrder: 3,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 60,
        glowColor: '#00ff88',
        visualStyle: 'high-energy',
        textPosition: 'bottom-center',
        fontColor: '#ffffff',
        fontOutlineColor: '#000080',
        fontOutlineWidth: 3,
      }),
      defaultPromptHints: 'Bright colors, cartoonish style, mobile UI elements, cheerful, accessible',
      tags: JSON.stringify(['mobile', 'casual', 'colorful', 'fun']),
      recommendedFonts: JSON.stringify(['Fredoka One', 'Nunito', 'Poppins']),
    },
    {
      id: 'tpl-unboxing',
      name: 'Unboxing',
      description: 'Excitement e surpresa para vídeos de unboxing e review',
      category: 'UNBOXING' as const,
      isPremium: false,
      sortOrder: 4,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 50,
        glowColor: '#ffdd00',
        visualStyle: 'high-energy',
        textPosition: 'top-left',
        fontColor: '#ffffff',
        fontOutlineColor: '#333333',
        fontOutlineWidth: 2,
      }),
      defaultPromptHints: 'Product center, surprised face, sparkles, bright lighting, excitement arrows',
      tags: JSON.stringify(['unboxing', 'review', 'product', 'surprise']),
      recommendedFonts: JSON.stringify(['Montserrat', 'Roboto Condensed', 'Source Sans Pro']),
    },
    {
      id: 'tpl-reaction',
      name: 'Reaction',
      description: 'Expressões exageradas para vídeos de reação',
      category: 'REACTION' as const,
      isPremium: false,
      sortOrder: 5,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 40,
        glowColor: '#ff6b00',
        visualStyle: 'high-energy',
        textPosition: 'middle-right',
        fontColor: '#ffffff',
        fontOutlineColor: '#000000',
        fontOutlineWidth: 3,
      }),
      defaultPromptHints: 'Split screen, exaggerated expression, shocked face, dramatic gestures',
      tags: JSON.stringify(['reaction', 'expression', 'shocked', 'entertainment']),
      recommendedFonts: JSON.stringify(['Anton', 'Oswald', 'Archivo Black']),
    },
    {
      id: 'tpl-tutorial',
      name: 'Tutorial',
      description: 'Limpo e informativo para tutoriais e conteúdo educacional',
      category: 'TUTORIAL' as const,
      isPremium: false,
      sortOrder: 6,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 20,
        glowColor: '#0066ff',
        visualStyle: 'clean',
        textPosition: 'middle-center',
        fontColor: '#ffffff',
        fontOutlineColor: '#003399',
        fontOutlineWidth: 2,
      }),
      defaultPromptHints: 'Clear layout, numbered steps, professional look, instructional arrows',
      tags: JSON.stringify(['tutorial', 'howto', 'educational', 'tips', 'guide']),
      recommendedFonts: JSON.stringify(['Inter', 'Poppins', 'Lato', 'Open Sans']),
    },
    {
      id: 'tpl-clickbait-energy',
      name: 'High Energy Clickbait',
      description: 'Máximo impacto visual para CTR elevado',
      category: 'CLICKBAIT_ENERGY' as const,
      isPremium: false,
      sortOrder: 7,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 100,
        glowColor: '#ff0000',
        visualStyle: 'high-energy',
        textPosition: 'bottom-center',
        fontColor: '#ffff00',
        fontOutlineColor: '#ff0000',
        fontOutlineWidth: 5,
      }),
      defaultPromptHints: 'Maximum contrast, arrows pointing to face, bright red/yellow, explosive energy',
      tags: JSON.stringify(['clickbait', 'high-ctr', 'viral', 'entertaining']),
      recommendedFonts: JSON.stringify(['Impact', 'Bangers', 'Permanent Marker']),
    },
    {
      id: 'tpl-clean-minimal',
      name: 'Clean & Minimal',
      description: 'Elegante e profissional para canais premium',
      category: 'CLEAN_MINIMAL' as const,
      isPremium: false,
      sortOrder: 8,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 0,
        visualStyle: 'minimal',
        textPosition: 'bottom-left',
        fontColor: '#ffffff',
        fontOutlineColor: 'transparent',
        fontOutlineWidth: 0,
      }),
      defaultPromptHints: 'Minimalist design, premium feel, lots of breathing room, refined aesthetics',
      tags: JSON.stringify(['minimal', 'clean', 'professional', 'premium', 'elegant']),
      recommendedFonts: JSON.stringify(['Playfair Display', 'Merriweather', 'EB Garamond']),
    },
    {
      id: 'tpl-cinematic',
      name: 'Cinemático / Dramático',
      description: 'Atmosfera cinematográfica para storytelling e vlogs premium',
      category: 'CINEMATIC' as const,
      isPremium: true,
      sortOrder: 9,
      defaultStyleConfig: JSON.stringify({
        glowIntensity: 30,
        glowColor: '#8800ff',
        visualStyle: 'cinematic',
        textPosition: 'bottom-center',
        fontColor: '#e8d5a3',
        fontOutlineColor: '#000000',
        fontOutlineWidth: 1,
      }),
      defaultPromptHints: 'Cinematic letterbox, dramatic lighting, moody atmosphere, film grain, bokeh',
      tags: JSON.stringify(['cinematic', 'dramatic', 'storytelling', 'vlog', 'film']),
      recommendedFonts: JSON.stringify(['Cormorant Garamond', 'Cinzel', 'Libre Baskerville']),
    },
  ];

  for (const template of templates) {
    await prisma.template.upsert({
      where: { id: template.id },
      update: {},
      create: {
        ...template,
        isActive: true,
        isSystemTemplate: true,
      },
    });
  }
  console.log(`✅ ${templates.length} templates criados`);

  // ─── Superadmin Tenant & User ────────────────────────────────────────────────
  const superadminEmail = process.env['SUPERADMIN_EMAIL'] ?? 'admin@thumbforge.com';
  const superadminPassword = process.env['SUPERADMIN_PASSWORD'] ?? 'ThumbForge@2025!';

  const superadminTenant = await prisma.tenant.upsert({
    where: { slug: 'thumbforge-superadmin' },
    update: {},
    create: {
      id: 'tenant-superadmin',
      name: 'ThumbForge Admin',
      slug: 'thumbforge-superadmin',
      status: 'ACTIVE',
    },
  });

  const passwordHash = await bcrypt.hash(superadminPassword, 12);

  await prisma.user.upsert({
    where: { id: 'user-superadmin' },
    update: {
      tenantId: superadminTenant.id,
      name: 'ThumbForge Admin',
      email: superadminEmail,
      passwordHash,
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      deletedAt: null,
    },
    create: {
      id: 'user-superadmin',
      tenantId: superadminTenant.id,
      name: 'ThumbForge Admin',
      email: superadminEmail,
      passwordHash,
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`✅ Superadmin criado: ${superadminEmail}`);
  console.log('\n✨ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
