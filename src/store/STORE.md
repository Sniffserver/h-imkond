# State Management Architecture (HÕIMU)

This directory contains the global state management for the application, built primarily with [Zustand](https://github.com/pmndrs/zustand).

## Directory Structure

We use a modular pattern for our stores to keep logic organized as it scales:

- `storeName.ts`: The main store definition (e.g., `meshStore.ts`), containing the Zustand `create` call and initial state logic.
- `types.ts`: TypeScript interfaces and types for the store's state and actions (e.g., `MeshState`, `MeshActions`).
- `selectors.ts`: Memoized or custom selector functions (e.g., `selectPeersArray`) for computing derived state and optimizing React re-renders.

## `meshStore`

The `meshStore` handles real-time mesh networking state, tracking peers, bridge nodes, GPS position, and map layers.

### Usage Pattern

1. **Reading State**: 
   To avoid unnecessary re-renders, always pass a selector to the hook or use the predefined selectors from `selectors.ts`:

   ```tsx
   import { useMeshStore, selectPeersArray, selectMeshStatus } from '../store/meshStore';

   // Good: Component only re-renders when this specific data changes
   const peers = useMeshStore(selectPeersArray);
   const lastSync = useMeshStore(selectMeshStatus);
   
   // Good: Inline selector
   const activeLayer = useMeshStore(state => state.activeLayer);
   ```

2. **Writing State**:
   Extract the action function from the store and call it.

   ```tsx
   import { useMeshStore } from '../store/meshStore';

   const setGpsPosition = useMeshStore(state => state.setGpsPosition);
   
   // Later in an effect or handler
   setGpsPosition({ lat: 58.37, lng: 26.72, accuracy: 10, timestamp: Date.now() });
   ```

3. **Complex Derived State (Selectors)**:
   For expensive derived data (like merging `peers` and `bridgePeers`), logic is kept in `selectors.ts` (`buildUnifiedPeersArray`). This ensures the computation runs only when necessary and returns a stable reference for React to avoid thrashing.
