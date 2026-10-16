# Local tournament elimination and finish

After a hand is settled, apply payouts first and eliminate only final zero stacks. Never mark a player eliminated merely for going all-in. Retain elimination history without duplicating records. Rank simultaneous eliminations by starting stack; BBA comparison subtracts that player's paid ante (the project's demo follows the TDA 2026 Rule 22 ordering basis). Equal comparison stacks retain a tied place range, with no invented tiebreaker or automatic prize split. Last survivor is champion and new deals are disabled.

Fixed physical seat order remains unchanged. Next BB is the next surviving seat clockwise after previous BB. Keep the old BB's physical position as next SB marker (no SB charge if vacant), and advance the button to the previous SB marker; this preserves dead-button progress instead of compacting the table. On entering heads-up, choose the next BB first and assign BTN/SB to the other survivor, avoiding a consecutive BB for a surviving former BB. Preflop begins at BTN/SB and postflop at BB. Dealing starts clockwise after the physical button; dead seats get no cards. Odd-chip order retains the physical button even when vacant.

The server deal action still authenticates in production (guest Preview remains permitted), accepts only a 2-6 player subset of the fixed six demo seats, canonicalizes their order, and accepts no cards/deck. This remains a LOCAL DEMO contract, not an authoritative multiplayer snapshot. No registration, wallet, prizes or persistent official standings are written.

UI shows live count, greyed out eliminated/empty seats, combined BTN/SB in HU, dead-button/SB notices, local finish places and champion. Eliminated players receive no future cards/blinds/antes and cannot act or re-enter. If you bust, you can keep clicking next hand to follow the remaining bots. Ring refill behavior is unchanged. Existing hands finish during breaks; no new hand can start during a break.

## Review presets (Preview/development only)
- `/poker-demo?game=tournament&pace=fast&scenario=short`: six players, 200 each, 50/100/100 BBA. In your first turn select ALL-IN amount and all-in. The current BB is shorter after BBA and can win the main pot, while other players contest a side pot. Depending on cards, one or several survivors remain. Check zero-stack seats, local places and subsequent roster reduction.
- `/poker-demo?game=tournament&pace=fast&scenario=heads-up`: two players (you, PLAYER 2), 200 each. Other four seats are empty from the start. Check combined BTN/SB, pre/postflop order, alternating BB, and champion termination. This is an explicit two-player demo, not a claim that the other four players were eliminated.
- Default tournament and ring presets retain their previous starting values. Saved tournament URLs ignore debug rosters. Reload starts a new local session.

## Verification
- 109 Node engine/server/render tests, including 13 table/ranking/accounting tests, 2 reduced-roster rendering tests and a deal-action roster check.
- 40 seeded complete six-to-one tournaments verify BB progression, no refills/re-entry, all chip conservation and exactly one champion. Earlier 300 seeded multi-street ante simulations remain covered.
- Two actual React component lifecycle tests use a controlled clock and deal stub: six -> two -> champion, and your elimination -> remaining bots -> champion. These exercise real click handlers, effects, requests, roster/card changes and terminal disabled controls. Test renderer does not verify actual browser pixels. Renderer 18.3.1 is pinned in the isolated CI runtime, not an application dependency.
- Clear previous awards/reveal before replacing cards/roster and guard absent hole-card keys. This handles intermediate renders when participants change.
- GitHub Actions runs engine tests, 42 isolated PostgreSQL permission checks, and UI lifecycle tests.

## Deployment sequence
User requested Railway setup/migration only after all development is complete. No Railway resources are created in this stage. Multiplayer server authority, recovery, registration/re-entry, wallet integration and prize delivery remain future work.

References: https://www.pokertda.com/view-poker-tda-rules/ Rules 22, 34, 36. These are behavior references, not copied rule text or a claim of tournament certification.
