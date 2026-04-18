// ─────────────────────────────────────────────────────────────────────────────
// ThumbForge AI — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

import type {
  UserRole,
  UserStatus,
  TenantStatus,
  SubscriptionStatus,
  GenerationStatus,
  VariantStatus,
  PaymentStatus,
  PaymentType,
  PaymentMethod,
  TemplateCategory,
  AssetType,
  AIProvider as AIProviderType,
  NotificationType,
  AuditAction,
  VariantType,
} from './enums.js';

export type { VariantType };

// ─── API Response Wrappers ─────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Auth Types ────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // userId
  tenantId: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// ─── User Types ────────────────────────────────────────────────────────────

export interface UserDTO {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Tenant Types ──────────────────────────────────────────────────────────

export interface TenantDTO {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
}

// ─── Plan & Subscription Types ─────────────────────────────────────────────

export interface PlanDTO {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  generationsLimit: number;
  features: string[];
  isActive: boolean;
}

export interface SubscriptionDTO {
  id: string;
  tenantId: string;
  planId: string;
  plan: PlanDTO;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  generationsUsed: number;
  generationsLimit: number;
  generationsRemaining: number;
}

// ─── Generation Types ──────────────────────────────────────────────────────

export interface GenerationRequestDTO {
  id: string;
  tenantId: string;
  userId: string;
  templateId?: string | null;
  status: GenerationStatus;
  renderMode?: GenerationRenderMode | null;
  freeTextPrompt?: string | null;
  styleConfig: StyleConfig;
  variants: GenerationVariantDTO[];
  assets: GenerationAssetDTO[];
  layers?: GenerationLayerDTO[] | undefined;
  errorMessage?: string | null;
  queuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedCostCents?: number | null;
  createdAt: string;
}

export interface GenerationVariantDTO {
  id: string;
  generationId: string;
  variantIndex: 1 | 2 | 3;
  status: VariantStatus;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  templateAdherenceScore?: number | null;
  textReadabilityScore?: number | null;
  visualImpactScore?: number | null;
  isPaid: boolean;
  createdAt: string;
}

export interface GenerationAssetDTO {
  id: string;
  generationId: string;
  type: AssetType;
  role?: 'INPUT' | 'PROCESSED' | 'GENERATED' | 'STATIC' | undefined;
  key?: string | null | undefined;
  sourceAssetId?: string | null | undefined;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | null | undefined;
  height?: number | null | undefined;
  isProcessed?: boolean | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface StyleConfig {
  fontFamily?: string | undefined;
  fontSize?: number | undefined;
  fontColor?: string | undefined;
  fontOutlineColor?: string | undefined;
  fontOutlineWidth?: number | undefined;
  textPosition?: TextPosition | undefined;
  text?: string | undefined;
  glowIntensity?: number | undefined; // 0-100
  glowColor?: string | undefined;
  dominantColors?: string[] | undefined;
  visualStyle?: VisualStyle | undefined;
  workflowMode?: GenerationWorkflowMode | undefined;
  dominantColor?: string | undefined;
  game?: string | undefined;
  videoType?: string | undefined;
  emotion?: string | undefined;
  mainObject?: string | undefined;
  facecamStyle?: string | undefined;
  realismGoal?: 'maintain' | 'realistic' | 'punchier' | undefined;
  templateLayoutId?: string | undefined;
  composition?: CompositionStyleConfig | undefined;
}

export type TextPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type VisualStyle =
  | 'gamer' | 'cinematic' | 'clean' | 'high-energy' | 'dramatic' | 'minimal';

export type GenerationWorkflowMode = 'reference' | 'template' | 'editor' | 'composition';
export type GenerationRenderMode = 'one-shot' | 'composite';
export type CompositionTemplatePreset = 'split-ui-hero' | 'split-reference-right' | 'custom';
export type CompositionDividerStyle = 'diagonal' | 'gradient' | 'hard-split';

export interface CompositionTextLayer {
  text: string;
  x: number;
  y: number;
  width?: number | undefined;
  fontSize: number;
  fontFamily?: string | undefined;
  fontWeight?: 'regular' | 'bold' | 'black' | undefined;
  fill: string;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
  shadowColor?: string | undefined;
  shadowBlur?: number | undefined;
  align?: 'left' | 'center' | 'right' | undefined;
  letterSpacing?: number | undefined;
  uppercase?: boolean | undefined;
}

export interface CompositionStyleConfig {
  enabled?: boolean | undefined;
  preset?: CompositionTemplatePreset | undefined;
  dividerStyle?: CompositionDividerStyle | undefined;
  generatedBackgroundPrompt?: string | undefined;
  generatedEffectsPrompt?: string | undefined;
  nativeText?: boolean | undefined;
  subjectPosition?: 'left' | 'right' | 'center' | undefined;
  objectPosition?: 'left-bottom' | 'center-bottom' | 'right-bottom' | undefined;
  backgroundBlurPx?: number | undefined;
  rimLightColor?: string | undefined;
  rimLightIntensity?: number | undefined;
  textLayers?: CompositionTextLayer[] | undefined;
}

export interface GenerationLayerDTO {
  id: string;
  generationId: string;
  variantIndex?: number | null | undefined;
  assetId?: string | null | undefined;
  name: string;
  type: string;
  zIndex: number;
  x: number;
  y: number;
  width?: number | null | undefined;
  height?: number | null | undefined;
  opacity: number;
  blendMode: string;
  rotation: number;
  isVisible: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Template Types ────────────────────────────────────────────────────────

export interface TemplateDTO {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  previewImageUrl: string;
  isPremium: boolean;
  isActive: boolean;
  defaultStyleConfig: StyleConfig;
  tags: string[];
}

// ─── Payment Types ─────────────────────────────────────────────────────────

export interface PaymentDTO {
  id: string;
  tenantId: string;
  userId: string;
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentStatus;
  amountCents: number;
  pixQrCode?: string | null;
  pixQrCodeText?: string | null;
  pixExpiresAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface CreatePaymentRequest {
  type: PaymentType;
  variantIds?: string[] | undefined;       // for SINGLE_VARIANT or COMBO_VARIANTS
  subscriptionPlanId?: string | undefined; // for SUBSCRIPTION
}

export interface CreatePaymentResponse {
  paymentId: string;
  pixQrCode: string;
  pixQrCodeText: string;
  pixExpiresAt: string;
  amountCents: number;
}

// ─── Download Types ────────────────────────────────────────────────────────

export interface DownloadDTO {
  id: string;
  variantId: string;
  paymentId: string;
  downloadedAt?: string | null;
  expiresAt: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

// ─── Notification Types ────────────────────────────────────────────────────

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ─── WebSocket Events ──────────────────────────────────────────────────────

export interface WsGenerationUpdate {
  generationId: string;
  status: GenerationStatus;
  variants?: GenerationVariantDTO[];
  error?: string;
}

export interface WsPaymentUpdate {
  paymentId: string;
  status: PaymentStatus;
  variantIds?: string[];
}

export type WsEvent =
  | { event: 'generation:update'; data: WsGenerationUpdate }
  | { event: 'payment:update'; data: WsPaymentUpdate }
  | { event: 'notification'; data: NotificationDTO };

// ─── Admin Types ───────────────────────────────────────────────────────────

export interface AdminDashboardStats {
  mrr: number;
  activeSubscribers: number;
  thumbsGeneratedThisMonth: number;
  thumbsDownloadedThisMonth: number;
  conversionRate: number;  // generations -> purchases
  estimatedAICostThisMonth: number;
  estimatedGrossMargin: number;
  activeTenantsCount: number;
  errorRateLastHour: number;
}

export interface AuditLogDTO {
  id: string;
  tenantId?: string | null;
  userId?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── AI Types (internal) ──────────────────────────────────────────────────

export interface ReferenceAnalysis {
  layout: 'centered' | 'left-dominant' | 'right-dominant' | 'split';
  personPosition?: 'left' | 'right' | 'center' | 'none' | undefined;
  objectsPosition: string[];
  backgroundType: 'solid' | 'gradient' | 'scene' | 'blurred';
  dominantColors: string[];
  glowIntensity: 'none' | 'subtle' | 'medium' | 'intense';
  style: VisualStyle;
  hasText: boolean;
  textHierarchy?: 'title-only' | 'title-subtitle' | 'multiple' | undefined;
  hasCTA: boolean;
  thumbnailStyle: 'gamer' | 'clickbait' | 'cinematic' | 'educational' | 'reaction';
  confidenceScore: number; // 0-1
}

export interface StructuredPrompt {
  referenceAnalysis?: ReferenceAnalysis | undefined;
  personDescription?: string | undefined;
  assetsDescription?: string[] | undefined;
  textContent?: string | undefined;
  styleConfig: StyleConfig;
  freeTextInstructions?: string | undefined;
  templateContext?: string | undefined;
  targetAudience: 'gamers' | 'general' | 'kids' | 'tech';
  platform: 'youtube' | 'twitch' | 'tiktok' | 'instagram';
  finalPrompt: string;  // constructed prompt for API
}

export interface AIGenerationResult {
  variants: Array<{
    index: number;        // 1-6 (supports up to 6 typed variants)
    imageBuffer: Buffer;
    revisedPrompt?: string | undefined;
    variantType?: VariantType | undefined;
  }>;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostCents: number;
  durationMs: number;
}

export interface AIProviderConfig {
  name: string;
  type: AIProviderType;
  isActive: boolean;
  isFallback: boolean;
}

// ─── Reference Analyzer ────────────────────────────────────────────────────

export interface ReferenceAnalysisFull extends ReferenceAnalysis {
  id?: string;
  visualHierarchy: 'subject-first' | 'object-first' | 'text-first' | 'balanced';
  facialEmotion: 'neutral' | 'confident' | 'excited' | 'shocked' | 'aggressive' | 'focused';
  secondaryColor: string | null;
  lightingStyle: 'flat' | 'studio' | 'dramatic' | 'ambient' | 'neon';
  depth: 'flat' | 'layered' | 'deep';
  visualDensity: 'clean' | 'balanced' | 'dense';
  legibilityScore: number;   // 0-100
  visualEnergy: 'low' | 'medium' | 'high';
  semanticTheme: string;
  textSafeZone: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'none';
  detectedObjects: string[];
  subjectScale: 'small' | 'medium' | 'large';
  styleKeywords: string[];
  compositionType?: ReferenceCompositionType | undefined;
  dominantObject?: string | null | undefined;
  dominantObjectPosition?: string | null | undefined;
  primaryColor?: string | null | undefined;
  saturationLevel?: ReferenceSaturationLevel | undefined;
  outlineStyle?: ReferenceOutlineStyle | undefined;
  facialEmotionIntensity?: ReferenceEmotionIntensity | undefined;
  facecamDetected?: boolean | undefined;
  facecamPosition?: FacecamPosition | undefined;
  facecamStyle?: FacecamStyleOption | undefined;
  enemyDetected?: boolean | undefined;
  enemyPosition?: 'left' | 'right' | 'center' | 'none' | undefined;
  realismLevel?: ReferenceRealismLevel | undefined;
  oneSecondReadability?: ReferenceReadabilityLevel | undefined;
  genericPosterArtRisk?: 'low' | 'medium' | 'high' | undefined;
  foregroundFocus?: string | null | undefined;
  midgroundFocus?: string | null | undefined;
  backgroundFocus?: string | null | undefined;
}

export type ReferenceCompositionType =
  | 'central'
  | 'diagonal'
  | 'first-person'
  | 'split'
  | 'facecam-overlay';

export type ReferenceSaturationLevel = 'low' | 'medium' | 'high';
export type ReferenceOutlineStyle = 'none' | 'clean' | 'thick' | 'neon' | 'comic';
export type ReferenceEmotionIntensity = 'low' | 'medium' | 'high';
export type ReferenceRealismLevel = 'stylized' | 'hybrid' | 'realistic';
export type ReferenceReadabilityLevel = 'weak' | 'good' | 'excellent';
export type FacecamPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'none';
export type FacecamStyleOption = 'clean' | 'neon' | 'cutout' | 'rounded' | 'none';
export type ReferenceTextHierarchy = 'none' | 'title-only' | 'title-subtitle' | 'multiple';

export interface VisualCTRScore {
  impact: number;
  clarity: number;
  style: number;
  legibility: number;
  referenceSimilarity: number;
}

export interface OneSecondTestResult {
  passes: boolean;
  explanation: string;
}

export interface ReferenceAutoExtraction {
  compositionType: ReferenceCompositionType;
  dominantObject: string;
  dominantObjectPosition: string;
  primaryColor: string;
  saturationLevel: ReferenceSaturationLevel;
  glowLevel: ReferenceAnalysisFull['glowIntensity'];
  outlineStyle: ReferenceOutlineStyle;
  facialEmotionIntensity: ReferenceEmotionIntensity;
  visualDensity: ReferenceAnalysisFull['visualDensity'];
  textHierarchy: ReferenceTextHierarchy;
  facecamPosition: FacecamPosition;
  facecamStyle: FacecamStyleOption;
  depth: ReferenceAnalysisFull['depth'];
  foregroundFocus: string;
  midgroundFocus: string;
  backgroundFocus: string;
}

export interface ReferenceGuidedFlow {
  detections: string[];
  questions: string[];
  preserveOptions: string[];
  autoExtraction: ReferenceAutoExtraction;
  visualScoring: VisualCTRScore;
  oneSecondTest: OneSecondTestResult;
}

export interface ReferenceAnalysisResponse {
  analysis: ReferenceAnalysisFull;
  guidedFlow: ReferenceGuidedFlow;
}

export interface TemplateIntelligenceInput {
  game: string;
  videoType: string;
  emotion: string;
  mainObject: string;
  text?: string | undefined;
  dominantColor: string;
  facecamStyle: string;
}

export interface TemplateLayoutSuggestion {
  id: string;
  name: string;
  hook: string;
  description: string;
  compositionType: ReferenceCompositionType;
  textZone: TextPosition;
  facecamPosition: FacecamPosition;
  visualPriority: string[];
  ctrReasoning: string;
  score: number;
  recommendedVariantType: VariantType;
  styleConfigPatch: Partial<StyleConfig>;
  freeTextDirective: string;
}

export interface TemplateLayoutResponse {
  input: TemplateIntelligenceInput;
  layouts: TemplateLayoutSuggestion[];
}

// ─── Prompt Builder ────────────────────────────────────────────────────────

export interface SubjectConfig {
  description: string;        // "homem com expressão chocada", "personagem de jogo"
  scale: 'small' | 'medium' | 'large';
  position: 'left' | 'right' | 'center';
}

export interface ExpressionConfig {
  emotion: 'neutral' | 'shocked' | 'excited' | 'confident' | 'aggressive' | 'focused' | 'happy';
  intensity: 'subtle' | 'moderate' | 'extreme';
}

export interface PoseConfig {
  type: 'frontal' | 'three-quarter' | 'profile' | 'action' | 'closeup';
  direction?: 'left' | 'right' | 'camera' | undefined;
}

export interface ObjectConfig {
  name: string;               // "espada", "logo", "badge", "arma"
  prominence: 'background' | 'accent' | 'foreground' | 'dominant';
  position?: string | undefined;
}

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'scene' | 'blurred' | 'abstract';
  description: string;        // "gradiente escuro roxo", "cenário de combate"
  complexity: 'minimal' | 'moderate' | 'complex';
}

export interface LightingConfig {
  style: 'flat' | 'studio' | 'dramatic' | 'ambient' | 'neon';
  rimLight: boolean;
  glowColor?: string | undefined;
  glowIntensity: 'none' | 'subtle' | 'medium' | 'intense';
}

export interface PaletteConfig {
  primary: string;            // hex
  secondary?: string | undefined;
  accent?: string | undefined;
  mood: 'dark' | 'vibrant' | 'neon' | 'pastel' | 'monochrome';
}

export interface CompositionConfig {
  layout: 'centered' | 'left-dominant' | 'right-dominant' | 'split';
  textPosition?: TextPosition | undefined;
  textContent?: string | undefined;
  textHierarchy?: 'title-only' | 'title-subtitle' | 'multiple' | undefined;
  hasCTA: boolean;
}

export interface ReadabilityConfig {
  priority: 'low' | 'medium' | 'high';
  contrast: 'low' | 'normal' | 'high';
  fontWeight: 'regular' | 'bold' | 'black';
}

export interface CTRConfig {
  strategy: 'curiosity' | 'shock' | 'value' | 'authority' | 'urgency';
  intensity: 'subtle' | 'moderate' | 'aggressive';
}

export interface PromptBuilderInput {
  subject:      SubjectConfig;
  expression:   ExpressionConfig;
  pose:         PoseConfig;
  objects:      ObjectConfig[];
  background:   BackgroundConfig;
  lighting:     LightingConfig;
  palette:      PaletteConfig;
  composition:  CompositionConfig;
  style:        VisualStyle;
  readability:  ReadabilityConfig;
  ctrFocus:     CTRConfig;
  variantType?: VariantType | undefined;
  freeTextOverride?: string | undefined;
  referenceAnalysis?: ReferenceAnalysisFull | undefined;
}

export interface BuiltPrompt {
  structuredInput: PromptBuilderInput;
  finalPrompt:     string;
  systemPrompt:    string;
  negativePrompt:  string;
  variantType:     VariantType;
  promptVersion:   string;
}

export type ImagePromptPartType = 'full-thumbnail' | 'background' | 'effects';

export interface BuiltImagePartPrompt {
  partType: ImagePromptPartType;
  finalPrompt: string;
  negativePrompt: string;
  promptVersion: string;
  variantType?: VariantType | undefined;
}

// ─── Variant Generator ─────────────────────────────────────────────────────

export interface VariantGenerationConfig {
  variantTypes: VariantType[];
  basePromptInput: PromptBuilderInput;
  referenceAnalysis?: ReferenceAnalysisFull;
}

export interface GeneratedVariantResult {
  variantType:   VariantType;
  variantIndex:  number;
  imageBuffer:   Buffer;
  builtPrompt:   BuiltPrompt;
  revisedPrompt?: string;
}

// ─── Export Jobs ──────────────────────────────────────────────────────────

export interface ExportOptions {
  upscale:          boolean;
  targetWidth:      number;    // default 1280
  targetHeight:     number;    // default 720
  sharpen:          boolean;
  sharpenSigma?:    number | undefined;    // 0.5–3.0
  contrastBoost:    boolean;
  faceEnhance:      boolean;
  removeWatermark:  boolean;
  format:           'webp' | 'png' | 'jpeg';
  quality:          number;    // 1-100
}

export interface ExportJobDTO {
  id:            string;
  variantId:     string;
  status:        'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  options:       ExportOptions;
  outputUrl?:    string | null;
  createdAt:     string;
  completedAt?:  string | null;
}

// ─── Edit Operations ──────────────────────────────────────────────────────

export interface EditOperationDTO {
  id:                  string;
  sourceGenerationId:  string;
  baseVariantId?:      string | null;
  resultGenerationId?: string | null;
  status:              'DRAFT' | 'COMMITTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  promptText:          string;
  preserveList:        string[];
  changeSet:           Record<string, unknown>;
  promptDelta:         string[];
  previewSummary:      string;
  createdAt:           string;
}
