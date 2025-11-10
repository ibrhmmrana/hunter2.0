/**
 * Gap analysis and diagnostic card builder for competitor comparison.
 * 
 * Computes gaps between subject business and leaders, generates severity-ranked
 * cards and actionable recommendations.
 */

export interface GapInputs {
  yourRating?: number | null;
  yourReviews?: number | null;
  yourReviews30d?: number | null;
  yourProfileScore?: number | null; // use visual_trust or listing completeness if needed
  yourLastPostDays?: number | null; // can be null/placeholder for now
  leaderRating?: number | null;
  leaderReviewsAvg?: number | null;
  leaderReviews30dAvg?: number | null;
  leaderProfileScore?: number | null;
  leaderPostFreqDays?: number | null;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface GapCardConfig {
  id: string;
  label: string;
  severity: Severity;
  youLabel: string;
  leaderLabel: string;
  deltaLabel: string;
  barYou: number;
  barLeader: number;
  actionLine: string;
}

export interface RankedAction {
  id: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  effort: 'Low' | 'Medium' | 'High';
  timeframe: string;
  relatedGapId: string;
}

export interface GapAnalysisResult {
  overallScore: number;
  leaderScore: number;
  topSummary: string;
  cards: GapCardConfig[];
  rankedActions: RankedAction[];
}

/**
 * Calculate overall strength score (0-100) from metrics.
 * 
 * Weighted blend:
 * - Reviews volume + rating: 40%
 * - Reviews last 30d: 30%
 * - Profile strength: 20%
 * - Social presence: 10% (placeholder-friendly)
 */
function calculateScore(
  rating: number | null,
  reviews: number | null,
  reviews30d: number | null,
  profileScore: number | null,
  lastPostDays: number | null
): number {
  let score = 0;

  // Reviews volume + rating (40% weight)
  if (rating !== null && reviews !== null) {
    // Normalize rating (0-5) to 0-40
    const ratingScore = (rating / 5) * 20;
    // Normalize reviews (0-1000+) to 0-20, capped at 1000
    const reviewsScore = Math.min(20, (reviews / 1000) * 20);
    score += ratingScore + reviewsScore;
  }

  // Reviews last 30d (30% weight)
  if (reviews30d !== null) {
    // Normalize (0-30 reviews/month) to 0-30
    const freshnessScore = Math.min(30, (reviews30d / 30) * 30);
    score += freshnessScore;
  }

  // Profile strength (20% weight)
  if (profileScore !== null) {
    // profileScore is already 0-100, scale to 0-20
    score += (profileScore / 100) * 20;
  } else {
    // Default to 50% if missing
    score += 10;
  }

  // Social presence (10% weight) - placeholder
  if (lastPostDays !== null && lastPostDays <= 7) {
    score += 10; // Active
  } else if (lastPostDays !== null && lastPostDays <= 30) {
    score += 5; // Somewhat active
  } else {
    score += 2; // Inactive
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Determine severity based on gap percentage.
 */
function getSeverity(gapPercent: number, absoluteGap?: number): Severity {
  if (gapPercent >= 0.75 || (absoluteGap !== undefined && absoluteGap >= 100)) {
    return 'critical';
  }
  if (gapPercent >= 0.5 || (absoluteGap !== undefined && absoluteGap >= 50)) {
    return 'high';
  }
  if (gapPercent >= 0.25 || (absoluteGap !== undefined && absoluteGap >= 20)) {
    return 'medium';
  }
  return 'low';
}

/**
 * Build gap analysis cards and ranked actions.
 */
export function buildGapCards(inputs: GapInputs): GapAnalysisResult {
  const {
    yourRating = null,
    yourReviews = null,
    yourReviews30d = null,
    yourProfileScore = null,
    yourLastPostDays = null,
    leaderRating = null,
    leaderReviewsAvg = null,
    leaderReviews30dAvg = null,
    leaderProfileScore = null,
    leaderPostFreqDays = null,
  } = inputs;

  // Calculate overall scores
  const overallScore = calculateScore(
    yourRating,
    yourReviews,
    yourReviews30d,
    yourProfileScore,
    yourLastPostDays
  );

  const leaderScore = calculateScore(
    leaderRating,
    leaderReviewsAvg,
    leaderReviews30dAvg,
    leaderProfileScore || 85, // Default leader profile score
    leaderPostFreqDays || 7
  );

  const cards: GapCardConfig[] = [];
  const actions: RankedAction[] = [];

  // 1. Reviews & Rating gap
  if (yourReviews !== null && leaderReviewsAvg !== null && leaderReviewsAvg > 0) {
    const reviewsGap = Math.max(0, leaderReviewsAvg - yourReviews);
    const reviewsGapPercent = yourReviews > 0 ? reviewsGap / yourReviews : 1;
    const ratingGap = (leaderRating || 0) - (yourRating || 0);
    
    const severity = getSeverity(reviewsGapPercent, reviewsGap);
    
    // Normalize for bar display (0-100)
    const barYou = Math.min(100, Math.max(5, (yourReviews / Math.max(leaderReviewsAvg, yourReviews)) * 100));
    const barLeader = 100;

    const youLabel = `${(yourRating || 0).toFixed(1)}★ · ${Math.round(yourReviews)} reviews`;
    const leaderLabel = `${(leaderRating || 0).toFixed(1)}★ · ${Math.round(leaderReviewsAvg)} avg`;
    const deltaLabel = reviewsGap > 0 
      ? `Need +${Math.round(reviewsGap)} reviews to look equally trusted.`
      : 'On par with leaders.';
    const actionLine = reviewsGap > 0
      ? `Ask ${Math.min(30, Math.max(10, Math.round(reviewsGap / 3)))} loyal customers for honest reviews this month.`
      : 'Maintain your review momentum.';

    cards.push({
      id: 'reviews_rating',
      label: 'Reviews & rating',
      severity,
      youLabel,
      leaderLabel,
      deltaLabel,
      barYou,
      barLeader,
      actionLine,
    });

    if (reviewsGap > 0) {
      actions.push({
        id: 'action_reviews',
        title: `Close the review gap (+${Math.round(reviewsGap)} reviews)`,
        description: `Leaders have ${Math.round(leaderReviewsAvg)} reviews on average. Build trust with ${Math.min(30, Math.max(10, Math.round(reviewsGap / 3)))} fresh reviews this month.`,
        impact: severity === 'critical' || severity === 'high' ? 'High' : 'Medium',
        effort: 'Medium',
        timeframe: '30 days',
        relatedGapId: 'reviews_rating',
      });
    }
  }

  // 2. Fresh activity gap
  if (yourReviews30d !== null && leaderReviews30dAvg !== null && leaderReviews30dAvg > 0) {
    const freshnessGap = Math.max(0, leaderReviews30dAvg - yourReviews30d);
    const freshnessGapPercent = yourReviews30d > 0 ? freshnessGap / yourReviews30d : 1;
    
    const severity = getSeverity(freshnessGapPercent, freshnessGap);
    
    const barYou = Math.min(100, Math.max(5, (yourReviews30d / Math.max(leaderReviews30dAvg, yourReviews30d)) * 100));
    const barLeader = 100;

    const youLabel = `${yourReviews30d} new review${yourReviews30d !== 1 ? 's' : ''} (30 days)`;
    const leaderLabel = `~${Math.round(leaderReviews30dAvg)} new reviews (30 days)`;
    const deltaLabel = freshnessGap > 0
      ? `Leaders get ~${Math.round(leaderReviews30dAvg)} reviews/mo vs your ${yourReviews30d}.`
      : 'Matching leader activity.';
    const actionLine = freshnessGap > 0
      ? 'Trigger a 30-day fresh review push.'
      : 'Keep the momentum going.';

    cards.push({
      id: 'fresh_activity',
      label: 'Fresh review activity',
      severity,
      youLabel,
      leaderLabel,
      deltaLabel,
      barYou,
      barLeader,
      actionLine,
    });

    if (freshnessGap > 0) {
      actions.push({
        id: 'action_freshness',
        title: 'Show activity this month (posts & updates)',
        description: `Leaders get ${Math.round(leaderReviews30dAvg)} reviews per month. Set up a review request campaign to match their pace.`,
        impact: severity === 'critical' || severity === 'high' ? 'High' : 'Medium',
        effort: 'Low',
        timeframe: '14 days',
        relatedGapId: 'fresh_activity',
      });
    }
  }

  // 3. Profile strength gap
  const yourProfile = yourProfileScore || 0;
  const leaderProfile = leaderProfileScore || 85; // Default leader profile
  const profileGap = leaderProfile - yourProfile;
  const profileGapPercent = yourProfile > 0 ? profileGap / yourProfile : 1;
  
  const severity = getSeverity(profileGapPercent, profileGap);
  
  const barYou = Math.min(100, Math.max(5, yourProfile));
  const barLeader = 100;

  const youLabel = yourProfile < 50 
    ? 'Missing photos & details'
    : yourProfile < 75
    ? 'Partial profile'
    : 'Mostly complete';
  const leaderLabel = 'Complete profile';
  const deltaLabel = profileGap > 20
    ? 'Missing core elements'
    : profileGap > 10
    ? 'Incomplete details'
    : 'Nearly complete';
  const actionLine = profileGap > 20
    ? 'Upload 10 photos, fix hours & add 2 categories.'
    : profileGap > 10
    ? 'Add missing photos and verify business details.'
    : 'Fine-tune your profile completeness.';

  cards.push({
    id: 'profile_strength',
    label: 'Profile strength',
    severity,
    youLabel,
    leaderLabel,
    deltaLabel,
    barYou,
    barLeader,
    actionLine,
  });

  if (profileGap > 10) {
    actions.push({
      id: 'action_profile',
      title: 'Refresh your profile visuals (10 photos)',
      description: 'Complete profiles rank higher. Upload photos, verify hours, and add relevant categories to match leaders.',
      impact: severity === 'critical' || severity === 'high' ? 'High' : 'Medium',
      effort: 'Low',
      timeframe: '7 days',
      relatedGapId: 'profile_strength',
    });
  }

  // 4. Social presence gap (placeholder-friendly)
  const yourPostDays = yourLastPostDays || 999;
  const leaderPostDays = leaderPostFreqDays || 7;
  const socialGap = yourPostDays - leaderPostDays;
  
  // Only show if there's a meaningful gap
  if (socialGap > 14) {
    const severity: Severity = socialGap > 60 ? 'high' : socialGap > 30 ? 'medium' : 'low';
    
    const barYou = Math.min(100, Math.max(5, (30 / Math.max(yourPostDays, 30)) * 100));
    const barLeader = 100;

    const youLabel = yourPostDays < 999 
      ? `Last post: ${yourPostDays} days ago`
      : 'No recent posts';
    const leaderLabel = leaderPostDays <= 7 ? 'Weekly posts' : 'Regular posts';
    const deltaLabel = socialGap > 30
      ? 'Inactive'
      : 'Less frequent';
    const actionLine = 'Post weekly updates to show you\'re active.';

    cards.push({
      id: 'social_presence',
      label: 'Social presence',
      severity,
      youLabel,
      leaderLabel,
      deltaLabel,
      barYou,
      barLeader,
      actionLine,
    });
  }

  // Build top summary
  const gapSeverities = cards.map(c => c.severity);
  const criticalCount = gapSeverities.filter(s => s === 'critical').length;
  const highCount = gapSeverities.filter(s => s === 'high').length;
  
  let topSummary = '';
  if (criticalCount > 0) {
    topSummary = `Critical gaps in ${cards.filter(c => c.severity === 'critical').map(c => c.label.toLowerCase()).join(' and ')}.`;
  } else if (highCount > 0) {
    topSummary = `Biggest gaps: ${cards.filter(c => c.severity === 'high').map(c => c.label.toLowerCase()).join(' and ')}.`;
  } else if (cards.length > 0) {
    topSummary = `Minor gaps in ${cards[0].label.toLowerCase()}.`;
  } else {
    topSummary = 'You\'re performing well compared to leaders.';
  }

  // Rank actions by severity (critical/high first, then by impact)
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  const impactOrder = { High: 3, Medium: 2, Low: 1 };
  
  const rankedActions = actions
    .sort((a, b) => {
      const aCard = cards.find(c => c.id === a.relatedGapId);
      const bCard = cards.find(c => c.id === b.relatedGapId);
      const aSeverity = aCard ? severityOrder[aCard.severity] : 0;
      const bSeverity = bCard ? severityOrder[bCard.severity] : 0;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }
      
      return impactOrder[b.impact] - impactOrder[a.impact];
    })
    .slice(0, 3); // Max 3 actions

  return {
    overallScore,
    leaderScore,
    topSummary,
    cards,
    rankedActions,
  };
}

