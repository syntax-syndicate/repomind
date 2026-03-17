# Implementation Summary: Trending Repository Fetching

## Overview

Successfully implemented a trending repository algorithm that identifies repositories catching momentum on GitHub, replacing the previous approach that only considered stars and pushed date.

## What Was Changed

### 1. Trending Score Algorithm (`scripts/fetch-trending-repos.mjs`)

**New Calculation Formula:**
```javascript
trending_score = (star_velocity_norm × 0.4-0.6) +
                 (recent_star_norm × 0.3) +
                 (push_recency_score × 0.1-0.3 × 10)
```

**Key Components:**
- **Star Velocity**: Stars per day since creation (captures rapid growth)
- **Recent Star Estimate**: Estimated stars gained in the tier window
- **Push Recency**: How recently the repository was updated

**Tier-Specific Weights:**
| Tier | Star Velocity | Recent Stars | Push Recency |
|------|--------------|--------------|--------------|
| Weekly | 0.6 | 0.3 | 0.1 |
| Monthly | 0.5 | 0.3 | 0.2 |
| 6-Month | 0.4 | 0.3 | 0.3 |
| Yearly | 0.4 | 0.3 | 0.3 |

### 2. All-Time Tier Optimization

**Previous:** Refreshed weekly (wasteful)
**New:** Refreshed every 5 years or on manual trigger

The workflow now:
- Checks git history for last all-time refresh
- Automatically skips if < 5 years have passed
- Preserves existing all-time repos when skipped
- Can be forced via workflow dispatch

### 3. Workflow Updates (`.github/workflows/refresh-repo-catalog.yml`)

**Added Features:**
- `force_all_time` workflow input for manual triggers
- Conditional all-time tier refresh logic
- Smart commit messages based on what was refreshed
- Lowered minimum threshold to 3000 repos (from 4000) to account for potential skips

### 4. TypeScript Interface Updates (`src/lib/repo-catalog.ts`)

**Added Field:**
```typescript
export interface CatalogRepoEntry {
  // ... existing fields
  trendingScore?: number;  // NEW: Present for trending tiers only
}
```

## Test Results

Validation test shows the algorithm correctly:
- ✅ Ranks high-velocity, recently active repos highest
- ✅ Penalizes inactive repos (low scores)
- ✅ Gives moderate scores to old but active repos
- ✅ Different tiers emphasize different factors appropriately

Example output:
```
1. rapid-growth-repo: 3.01 (5000 stars, 112 stars/day, pushed today)
2. very-new-hot-repo: 2.93 (1000 stars, 132 stars/day, pushed 1 day ago)
3. old-stable-repo: 2.02 (50k stars, 12 stars/day, old but active)
4. moderate-repo: 1.23 (500 stars, 7 stars/day, pushed 7 days ago)
5. stagnant-repo: 0.44 (10k stars, inactive for months)
```

## Benefits of This Approach

### 1. Captures True Trending Momentum
- Identifies repositories gaining stars rapidly
- Considers both absolute and relative growth
- Weighs recent activity appropriately

### 2. Efficient Resource Usage
- All-time tier: 5-year refresh cycle saves ~260 weekly API calls
- Trending tiers: Fetch 2× candidates to ensure quality selection
- Smart deduplication prevents overlap

### 3. GitHub API Compatibility
- No direct "trending" API exists on GitHub
- Uses standard search API with time-based queries
- Applies mathematical scoring on top of search results

### 4. Flexible and Tunable
- Weights can be adjusted per tier
- Formula is documented and testable
- Can add new factors (forks, issues, etc.) in the future

## How to Use

### Run Full Refresh (All Tiers)
```bash
# Via npm script
npm run data:refresh:repos

# Or directly
GITHUB_TOKEN=your_token node scripts/fetch-trending-repos.mjs
```

### Skip All-Time Tier
```bash
# Preserves existing all-time repos
GITHUB_TOKEN=your_token node scripts/fetch-trending-repos.mjs --skip-all-time
```

### Force All-Time Refresh (GitHub Actions)
```bash
gh workflow run refresh-repo-catalog.yml -f force_all_time=true
```

### Test Algorithm Locally
```bash
node scripts/test-trending-algorithm.mjs
```

## Output Data Format

The `public/data/top-repos.json` file now includes trending scores:

```json
{
  "owner": "microsoft",
  "repo": "semantic-kernel",
  "stars": 25847,
  "description": "Integrate cutting-edge LLM technology...",
  "topics": ["ai", "llm", "semantic-kernel"],
  "language": "C#",
  "tier": "monthly",
  "rank": 4532,
  "trendingScore": 3.45
}
```

**Note:** `trendingScore` is only present for trending tiers (weekly, monthly, 6-month, yearly), not all-time.

## Future Enhancements

Potential improvements to consider:

1. **Fork velocity**: Include fork rate in trending score
2. **Community engagement**: Factor in issues/PR activity
3. **Language-specific trending**: Calculate trending within each language
4. **Topic-specific trending**: Identify trending within topic areas
5. **Time-series analysis**: Track trending scores over time
6. **Machine learning**: Train a model to predict "breakout" repos

## Documentation

Comprehensive documentation created in:
- `docs/TRENDING_ALGORITHM.md` - Full algorithm explanation
- `scripts/test-trending-algorithm.mjs` - Algorithm validation test

## Validation Checklist

- [x] Trending score algorithm implemented correctly
- [x] All-time tier refresh cycle set to 5 years
- [x] Workflow conditionally skips all-time tier
- [x] TypeScript interfaces updated
- [x] Test script validates algorithm behavior
- [x] Documentation created
- [x] Linting issues fixed
- [x] Code compiles without type errors

## Next Steps for Deployment

1. **Merge this PR** to the main branch
2. **Trigger initial run** with `force_all_time=true` to populate all tiers
3. **Monitor weekly runs** to ensure trending detection works as expected
4. **Optionally display trending scores** in the UI to show "trending strength"
5. **Consider A/B testing** user engagement with trending vs. all-time repos

---

The implementation is complete, tested, and ready for production use. The trending algorithm now effectively identifies repositories catching momentum on GitHub while optimizing resource usage through smart tier refresh scheduling.
