# Personalizing Chat Icons

I have updated the chat interface to use personalized icons for the Bot and User, replacing the generic Lucide icons.

## Changes

### New Icon Components

I created two new SVG components in `src/components/icons`:

- **BotIcon**: A custom icon representing RepoMind, featuring a brain/circuit design.
- **UserIcon**: A custom icon representing the user, featuring a modern profile silhouette.

### Updated Components

I updated the following components to use the new icons:

- `src/components/ChatInterface.tsx`: Replaced `Bot` and `User` icons in the chat message list and streaming indicator.
- `src/components/ProfileChatInterface.tsx`: Replaced `Bot` and `User` icons in the profile chat.
- `src/components/ProfileLoader.tsx`: Replaced `User` icon in the error state.
- `src/components/DeveloperCard.tsx`: Replaced `User` icon in the avatar fallback.
- `src/components/FeatureTiles.tsx`: Replaced `User` icon in the "GitHub Profile Intel" feature tile.

## Verification

The new icons are now used consistently across the application, providing a more personalized and branded experience while maintaining the existing theme.
