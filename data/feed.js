/* Curated posts. Most hand-written news posts were retired once their sources began streaming in live.
   Add evergreen or Magestic-internal posts here. */
const POSTS_CURATED = [
{a:"Matt MacLean",s:"Director of AI · Magestic Technologies",av:"magestic",t:"internal",d:"2026-08-07",when:"Aug 7",w:9,
 body:"Heads up, developers: Claude Code's default permissions mode changes to 'auto mode' on August 14.\n\nIn auto mode a classifier reviews each tool call before it runs — safe actions proceed automatically, risky ones are blocked — and Anthropic reports auto-mode users ship ~25% more PRs with safety matching or beating manual review.\n\nMagestic guidance: auto mode is fine (and productive) for our own repos. For external or freshly cloned code, switch to Plan or Ask mode with Shift+Tab — the classifier is not the right last line of defense against poisoned instruction files. bypassPermissions remains prohibited. See the Security card in Learning for the full agent-hygiene checklist.",
 tags:["Developers","Everyone"],topic:"Tools",link:{u:"https://claude.com/blog/auto-mode",b:"Anthropic: Auto mode for Claude Code",s:"claude.com"}},
{a:"Matt MacLean",s:"Director of AI · Magestic Technologies",av:"magestic",t:"internal",d:"2026-07-17",when:"Today",
 body:"Welcome to the Magestic AI Hub. This is our one place to follow AI industry news, the tools worth watching, and everything from our internal research, distilled so nobody has to read a 40-page report to get the takeaway.\n\nUse the role filter on the left to see what is most relevant to your job, check the Research tab for the two-week research library, and the Learning tab for free courses (most with certificates). New posts land here as the industry moves, which lately is daily.",
 tags:["Everyone"],topic:"Hub",link:null}
];
