# Homepage component sources

The November 13, 2026 homepage uses these source components, adapted for Tavrik's existing React, Motion and plain-CSS setup. These are presentation components, not product integrations or claims of customer value.

| Component | Upstream source | Tavrik adaptation |
| --- | --- | --- |
| Circular Carousel | [21st listing](https://21st.dev/@support_596fe4b8/components/circular-carousel), [Nexus public registry](https://www.nexus-ui.com/api/registry/circular-carousel) | Retains wrapped circular positions, card transforms and spring selection. Removes sound, automatic rotation and fling; adds linked capability descriptions, keyboard controls, static no-JavaScript list and live reduced-motion handling. Uses motion/react and plain CSS. |
| Typing Animation | [21st listing](https://21st.dev/@dillionverma/components/typing-animation), [Magic UI source](https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/typing-animation.tsx) | Repeats one phrase while visible with reserved space, complete server text, accessible name, timer cleanup and live reduced-motion support. |
| Original animated question input (removed November 15) | [21st listing](https://21st.dev/@manuarora700/components/placeholders-and-vanish-input), [Aceternity source registry](https://ui.aceternity.com/registry/placeholders-and-vanish-input.json) | Adapts the animated placeholder and arrow into a labeled local synthetic-record filter. Keeps the entered question visible; omits the canvas erase effect and rotating prompts. No AI inference, upload, persistence or remote query. |
| LogoLoop, CardNav, PixelCard | [React Bits source](https://github.com/DavidHDev/react-bits/tree/main/src/content) | LogoLoop uses a horizontal wordmark strip with status labels, continuous movement and a reduced-motion static mode. CardNav uses existing links, inline arrow symbols instead of an icon package, focus restoration, inert closed content, static fallback and live reduced-motion updates. PixelCard previously supplied empty light pricing cards; that presentation and its import were removed on November 16 in favor of demo-led custom pricing. The unused upstream component and license are retained. |
| AnimatedContent | Existing React Bits component in this repository | Coordinated once-only section entrances with larger travel and scale; content remains visible without JavaScript. |

React Bits license is retained in [licenses/react-bits.txt](licenses/react-bits.txt). Magic UI and Aceternity MIT notices are in [licenses/marketing-mit.txt](licenses/marketing-mit.txt). Nexus's free component is used in this end-product under its [component license, section 5](https://www.nexus-ui.com/terms); no standalone component distribution or premium source access is implied.

The logo strip uses GitHub, Python and Onshape symbols alongside readable names. These identify tools, not technology partners or endorsements. Git metadata and the Python collector are local capabilities. ROS 2 needs hardware acceptance; Onshape needs activation and real-provider acceptance. These labels must change only with supporting evidence.

The 21st MCP configuration exists, but no API key was available in this session. Sources above were retrieved from their authors' public documentation/registries. No authenticated 21st CLI or MCP connection is claimed.

## November 17 SonarGrid and Scroll Reveal

The founder supplied SonarGrid in this conversation. Added `components/ui/sonar-grid.tsx` and the homepage wrapper `app/components/hero-sonar.tsx`, with bounded numeric inputs, explicit pause, live reduced motion, hidden/off-screen suspension, observer/timer cleanup and preserved links. The rings are decorative, not recorded robot events. No stock assets or new dependencies are required.

November 18 update: the founder requested an automatic homepage background without a pause/play option. The hero wrapper now has no control or manual state and disables pointer-triggered rings. Automatic pings, live reduced motion and hidden/off-screen suspension remain. The reusable SonarGrid's optional `paused` prop remains available internally; it is not a homepage user control. Redundant homepage introductory labels and supporting slogans were also removed; synthetic/evidence and integration-readiness labels remain.

Pulled React Bits [Scroll Reveal](https://reactbits.dev/text-animations/scroll-reveal) TypeScript/plain CSS from revision `d01aa914dcbe76da8b2923ebf872b5c8b1066e4c`, under `src/ts-default/TextAnimations/ScrollReveal/`. Local files are `app/components/ScrollReveal.tsx` and `ScrollReveal.css`. Added an optional heading ID to preserve the section label; homepage styling inherits the existing typography. Uses installed GSAP, with upstream reduced-motion cleanup. Existing React Bits license above applies. The workflow heading's previous parent entrance was removed to avoid overlapping effects. No separate reference demo or unsupported public-beta copy was added.

The founder authorized direct code integration after the Paper quota was disclosed. The general Paper-first workflow remains in effect for subsequent design tasks.

## Supplied BackgroundPaths usage

The November 13 user prompt supplied the component source. Adapted into components/ui with Motion (already installed), deterministic timing, decorative account-entry mode, pause/reduced-motion support and an actual demo destination. No stock images are required. See social-sign-in.md for Tailwind structure and dependencies.

## November 15 homepage refinement

The question input was removed at the founder’s request and replaced with a rhetorical typewriter heading. TypingAnimation now repeats while visible and stops for reduced motion or hidden tabs. The carousel precedes the comparison; LogoLoop follows it, moves continuously without a separate pause control and displays GitHub with sign-in activation pending. Keyboard focus still stops the underlying loop for link access. Stronger existing React Bits AnimatedContent entrances connect the sections; no new dependencies or paid sources were needed.


## Tool symbols, 2026-11-18

Later November 18 direction: the homepage strip now shows symbols and names only; per-tool captions and the supporting status note are removed. Detailed capability/readiness information remains in the walkthrough. Logos do not establish an active integration or endorsement.

GitHub and Python SVGs are from the [Simple Icons source](https://github.com/simple-icons/simple-icons/tree/develop/icons), stored in public/brands with its CC0 license. Onshape uses its [official touch icon](https://www.onshape.com/cdn-images/f35a61ea6bddcaa17307207813b50aaf8d6b846d-180x180.png), retrieved from its homepage icon declaration. Brand marks remain their respective owners’ identities; no endorsement or active integration is implied. Assets are served locally, with fixed dimensions and visible text names; moving and static/reduced-motion views use the same marks. The strip now displays the three requested tools. ROS 2 support/status remains documented in the product walkthrough.
