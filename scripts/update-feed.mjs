#!/usr/bin/env node
/* Regenerates data/feed-live.js from public RSS/Atom feeds.
   No dependencies — plain Node 20+ (global fetch).
   Run locally:  node scripts/update-feed.mjs
   Run on GitHub: .github/workflows/refresh-feed.yml calls this on a 2.5-hour schedule and commits changes. */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "feed-live.js");
const DEFAULT_PER_FEED = 2;
const MAX_TOTAL = 150;
const MAX_COMPANY_ITEMS = 90;

/* Public feeds. Each entry: url, display name, avatar key (from data/content.js AV), post type, role tags, topic. */
const FEEDS = [
  /* news organizations & industry press (max 3 each) */
  { url: "https://openai.com/news/rss.xml", who: "Official OpenAI newsroom", a: "OpenAI", av: "openai", t: "official", tags: ["Everyone"], topic: "Models", max: 2 },
  { w: 5, url: "https://rsshub.bestblogs.dev/anthropic/news", who: "Official Anthropic announcements (community RSS mirror)", a: "Anthropic", av: "anthropic", t: "official", tags: ["Everyone"], topic: "Models", max: 3 },
  { w: 6, url: "https://github.com/anthropics/claude-code/releases.atom", who: "Claude Code releases & changelog", a: "Claude Code Changelog", av: "anthropic", t: "official", tags: ["Developers"], topic: "Tools", max: 2 },
  { url: "https://blog.google/technology/ai/rss/", who: "Official Google AI blog", a: "Google AI", av: "google", t: "official", tags: ["Everyone"], topic: "Models", max: 2 },
  { url: "https://github.blog/feed/", who: "Official GitHub blog", a: "GitHub", av: "github", t: "official", tags: ["Developers"], topic: "Tools", max: 3 },
  { w: 4, url: "https://www.compositesworld.com/rss/news", kw: true, who: "The composites manufacturing industry's leading publication", a: "CompositesWorld", av: "industry", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 4 },
  { w: 4, url: "https://mtdcnc.com/feed/", kw: true, who: "CNC machining industry news & video (UK)", a: "MTDCNC", av: "industry", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", max: 3 },
  /* SMEs & thought leaders with open feeds (max 2 each, all equal) */
  { url: "https://simonwillison.net/atom/everything/", who: "Independent AI researcher & blogger", a: "Simon Willison", av: "willison", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Adoption" },
  { url: "https://www.oneusefulthing.org/feed", who: "Wharton professor · AI adoption (One Useful Thing)", a: "Ethan Mollick", av: "mollick", t: "voice", tags: ["Marketing & Sales", "Product Managers", "Everyone"], topic: "Adoption" },
  { url: "https://newsletter.kentbeck.com/feed", who: "Creator of test-driven development", a: "Kent Beck", av: "beck", t: "voice", tags: ["Developers"], topic: "Adoption" },
  { url: "https://thezvi.substack.com/feed", a: "Zvi Mowshowitz", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { url: "https://garymarcus.substack.com/feed", a: "Gary Marcus", av: "auto", t: "voice", tags: ["Marketing & Sales", "Everyone"], topic: "Adoption" },
  { url: "https://www.interconnects.ai/feed", a: "Nathan Lambert", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.platformer.news/rss", kw: "title", a: "Casey Newton", av: "auto", t: "voice", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://www.thealgorithmicbridge.com/feed", a: "Alberto Romero", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://huyenchip.com/feed.xml", a: "Chip Huyen", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://magazine.sebastianraschka.com/feed", a: "Sebastian Raschka", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.exponentialview.co/feed", a: "Azeem Azhar", av: "auto", t: "voice", tags: ["Marketing & Sales"], topic: "Adoption" },
  { url: "https://www.dwarkesh.com/feed", a: "Dwarkesh Patel", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.aisnakeoil.com/feed", a: "AI Snake Oil (Narayanan & Kapoor)", av: "auto", t: "voice", tags: ["Marketing & Sales", "Everyone"], topic: "Adoption" },
  { url: "https://joereis.substack.com/feed", a: "Joe Reis", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://kozyrkov.medium.com/feed", a: "Cassie Kozyrkov", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { url: "https://www.latent.space/feed", a: "swyx · Latent Space", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://hamel.dev/index.xml", a: "Hamel Husain", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  /* auto-verified expansion: 83 additional working feeds (Jul 17, 2026) */
  { url: "https://newsletter.pragmaticengineer.com/feed", a: "Gergely Orosz", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://aiweirdness.com/rss/", a: "Janelle Shane", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.understandingai.org/feed", a: "Timothy B. Lee", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.wheresyoured.at/rss/", a: "Ed Zitron", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Industry AI" },
  { url: "https://lastweekin.ai/feed", a: "Last Week in AI", av: "auto", t: "voice", tags: ["Everyone"], topic: "Models" },
  { url: "https://thesequence.substack.com/feed", a: "TheSequence", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://natesnewsletter.substack.com/feed", a: "Nate B. Jones", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { url: "https://aisupremacy.substack.com/feed", a: "Michael Spencer", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Industry AI" },
  { url: "https://www.chinatalk.media/feed", kw: "title", a: "Jordan Schneider", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Industry AI" },
  { url: "https://www.semianalysis.com/feed", a: "Dylan Patel", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Industry AI" },
  { url: "https://www.lennysnewsletter.com/feed", kw: "title", a: "Lenny Rachitsky", av: "auto", t: "voice", tags: ["Product Managers"], topic: "Adoption" },
  { url: "https://benn.substack.com/feed", kw: "title", a: "Benn Stancil", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://www.dataengineeringweekly.com/feed", a: "Data Engineering Weekly", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://seattledataguy.substack.com/feed", a: "Ben Rogojan (newsletter)", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://roundup.getdbt.com/feed", a: "Analytics Engineering Roundup", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://vickiboykis.com/index.xml", a: "Vicki Boykis", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Adoption" },
  { url: "https://cameronrwolfe.substack.com/feed", a: "Cameron R. Wolfe", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://newsletter.maartengrootendorst.com/feed", a: "Maarten Grootendorst", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://karpathy.bearblog.dev/feed/", a: "Andrej Karpathy (blog)", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.astralcodexten.com/feed", kw: "title", a: "Scott Alexander", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.gradientflow.com/feed/", a: "Ben Lorica", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://machinelearningmastery.com/blog/feed/", a: "Machine Learning Mastery", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://jurgengravestein.substack.com/feed", a: "Jurgen Gravestein", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://eugeneyan.com/rss/", a: "Eugene Yan (feed)", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://bair.berkeley.edu/blog/feed.xml", a: "BAIR Blog", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://blog.ml.cmu.edu/feed/", a: "CMU ML Blog", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://news.mit.edu/rss/topic/artificial-intelligence2", a: "MIT News · AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://thegradient.pub/rss/", a: "The Gradient", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.lesswrong.com/feed.xml", a: "LessWrong", av: "auto", t: "voice", tags: ["Developers"], topic: "Adoption" },
  { url: "https://artificialintelligenceact.eu/feed/", a: "EU AI Act Newsletter", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { w: -2, url: "https://www.technologyreview.com/feed/", kw: "title", skip: /^The Download/i, a: "MIT Technology Review", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 1 },
  { domain: true, url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss", a: "IEEE Spectrum AI", av: "auto", t: "industry", tags: ["Developers"], topic: "Models" },
  { w: -2, url: "https://www.marktechpost.com/feed/", a: "MarkTechPost", av: "auto", t: "industry", tags: ["Developers"], topic: "Models", max: 1 },
  { w: -2, url: "https://syncedreview.com/feed/", a: "Synced", av: "auto", t: "industry", tags: ["Developers"], topic: "Models", max: 1 },
  { url: "https://bdtechtalks.com/feed/", a: "Ben Dickson · TechTalks", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { w: -2, url: "https://the-decoder.com/feed/", a: "The Decoder", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models", max: 1 },
  { url: "https://towardsdatascience.com/feed", a: "Towards Data Science", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { w: -2, url: "https://www.oreilly.com/radar/feed/index.xml", kw: "title", a: "O'Reilly Radar", av: "auto", t: "industry", tags: ["Developers"], topic: "Adoption" },
  { url: "https://flowingdata.com/feed", kw: "title", a: "FlowingData", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { w: -2, url: "https://sloanreview.mit.edu/feed/", kw: "title", a: "MIT Sloan Mgmt Review", av: "auto", t: "industry", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { w: -2, url: "https://knowledge.wharton.upenn.edu/feed/", kw: "title", a: "Knowledge at Wharton", av: "auto", t: "industry", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { w: -2, url: "https://www.mckinsey.com/insights/rss", kw: "title", a: "McKinsey Insights", av: "auto", t: "industry", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { w: 4, url: "https://www.mmsonline.com/rss/news", kw: true, who: "Modern Machine Shop · machining technology", a: "Modern Machine Shop", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 3, url: "https://www.additivemanufacturing.media/rss/news", kw: true, who: "Industrial 3D printing publication", a: "Additive Manufacturing Media", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 3, url: "https://www.productionmachining.com/rss/news", kw: true, who: "Precision machining publication", a: "Production Machining", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 3, url: "https://www.manufacturingdive.com/feeds/news/", kw: true, who: "Manufacturing industry business news", a: "Manufacturing Dive", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 3, url: "https://iiot-world.com/feed/", who: "Industrial IoT & AI publication", a: "IIoT World", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { domain: true, url: "https://www.therobotreport.com/feed/", who: "Robotics business & engineering news", a: "The Robot Report", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 4, url: "https://compositesmanufacturingmagazine.com/feed/", who: "American Composites Manufacturers Association magazine", a: "Composites Manufacturing", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 3, url: "https://www.aerospacemanufacturinganddesign.com/rss/", a: "Aerospace Mfg & Design", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: 3, url: "https://www.moldmakingtechnology.com/rss/news", kw: true, who: "Mold & tooling manufacturing technology", a: "MoldMaking Technology", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.ptonline.com/rss/news", kw: true, who: "Plastics Technology · processing & molding", a: "Plastics Technology", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.tctmagazine.com/rss/", kw: true, who: "Additive manufacturing & 3D printing intelligence", a: "TCT Magazine", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://3dprintingindustry.com/feed/", kw: true, who: "Additive manufacturing industry news", a: "3D Printing Industry", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://interestingengineering.com/feed", kw: "title", who: "Engineering & industrial technology news", a: "Interesting Engineering", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 2 },
  { url: "https://www.bing.com/news/search?q=AI%20%22quality%20inspection%22%20OR%20%22machine%20vision%22%20manufacturing&format=rss", a: "AI Inspection & Machine Vision", av: "auto", t: "industry", tags: ["Application Specialists", "Developers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=AI%20%22press%20brake%22%20OR%20%22punching%22%20OR%20%22laser%20cutting%22&format=rss", a: "AI in Fabrication Equipment", av: "auto", t: "industry", tags: ["Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 3 },
  /* AI Regulatory & Compliance bucket (added Jul 21 2026): US/EU regulation, export controls, ITAR,
     Chinese-model scrutiny, data sovereignty, AI governance frameworks. w:2 so it ranks with premium trade press. */
  /* Breaking AI security & majors watch (added Jul 23 2026 after the OpenAI/Hugging Face breach was missed):
     high-weight lanes so major security incidents and frontier-lab news reach the top of the feed within a refresh. */
  { w: 8, url: "https://www.bing.com/news/search?q=AI%20(hacked%20OR%20breach%20OR%20%22prompt%20injection%22%20OR%20vulnerability%20OR%20exploit)&format=rss", a: "AI Security & Threat Watch", who: "AI security incidents, breaches, and threat research", av: "auto", t: "official", tags: ["Developers", "Product Managers", "Everyone"], topic: "Regulatory", max: 2 },
  { w: 6, url: "https://www.bing.com/news/search?q=%22Hugging%20Face%22&format=rss", a: "Hugging Face Watch", who: "News about the open-model hub", av: "auto", t: "official", tags: ["Developers", "Everyone"], topic: "Models", max: 3 },
  { w: 5, url: "https://www.bing.com/news/search?q=%22OpenAI%22&format=rss", a: "OpenAI News Watch", who: "Major OpenAI news across all outlets (Reuters, Bloomberg, CNBC syndicated)", av: "openai", t: "official", tags: ["Everyone"], topic: "Models", max: 3 },
  { w: 5, url: "https://www.bing.com/news/search?q=%22Anthropic%22&format=rss", a: "Anthropic News Watch", who: "Major Anthropic news across all outlets", av: "anthropic", t: "official", tags: ["Everyone"], topic: "Models", max: 3 },
  { w: 4, url: "https://feeds.feedburner.com/TheHackersNews", kw: "title", a: "The Hacker News", who: "Cybersecurity news · AI-related items only", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Regulatory", max: 2 },
  { w: 3, url: "https://www.bing.com/news/search?q=AI%20(regulation%20OR%20legislation%20OR%20%22executive%20order%22)&format=rss", a: "AI Regulation Watch", who: "US & EU AI regulation news", av: "auto", t: "official", tags: ["Marketing & Sales", "Product Managers", "Everyone"], topic: "Regulatory", max: 3 },
  { w: 3, url: "https://www.bing.com/news/search?q=AI%20(ITAR%20OR%20%22export%20control%22%20OR%20%22export%20controls%22%20OR%20%22export%20restrictions%22)&format=rss", a: "AI Export Controls & ITAR", who: "Export control, ITAR, and trade-restriction news touching AI", av: "auto", t: "official", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 3 },
  { w: 3, url: "https://www.bing.com/news/search?q=%22Chinese%20AI%22%20(ban%20OR%20security%20OR%20restrictions%20OR%20%22national%20security%22)&format=rss", a: "Chinese AI Models · Security & Policy", who: "Security, privacy, and policy scrutiny of Chinese AI models", av: "auto", t: "official", tags: ["Marketing & Sales", "Developers", "Everyone"], topic: "Regulatory", max: 3 },
  { w: 3, url: "https://www.bing.com/news/search?q=DeepSeek%20(ban%20OR%20security%20OR%20restriction%20OR%20privacy%20OR%20ITAR)&format=rss", a: "Chinese Open Models · Risk Watch", who: "DeepSeek and Chinese open-model security & policy scrutiny", av: "auto", t: "official", tags: ["Marketing & Sales", "Developers"], topic: "Regulatory", max: 2 },
  { w: 3, url: "https://www.bing.com/news/search?q=%22AI%20Act%22%20(compliance%20OR%20enforcement%20OR%20implementation)&format=rss", a: "AI Act Enforcement Watch", who: "EU AI Act compliance and enforcement news", av: "auto", t: "official", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 2 },
  { w: 3, url: "https://www.bing.com/news/search?q=%22AI%20governance%22&format=rss", a: "AI Governance & Compliance", who: "AI governance frameworks, NIST, ISO/IEC 42001, compliance", av: "auto", t: "official", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 3 },
  { w: 3, url: "https://www.bing.com/news/search?q=AI%20(%22data%20sovereignty%22%20OR%20CMMC%20OR%20DFARS%20OR%20%22defense%20contractor%22%20compliance)&format=rss", a: "AI in Defense Compliance", who: "Data sovereignty, CMMC, DFARS, and defense-supplier AI compliance", av: "auto", t: "official", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 2 },
  { w: 3, url: "https://artificialintelligenceact.eu/feed/", a: "EU AI Act Newsletter", who: "Tracking the EU AI Act's implementation", av: "auto", t: "official", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 2 },
  { w: 2, url: "https://cset.georgetown.edu/feed/", a: "CSET Georgetown", who: "Center for Security and Emerging Technology · AI policy research", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 2 },
  { w: 2, url: "https://fedscoop.com/feed/", kw: "title", a: "FedScoop", who: "Federal government technology & AI policy news", av: "auto", t: "industry", tags: ["Marketing & Sales", "Product Managers"], topic: "Regulatory", max: 2 },
  { url: "https://changelog.com/practicalai/feed", a: "Practical AI", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://lexfridman.com/feed/podcast/", kw: "title", a: "Lex Fridman Podcast", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://blogs.nvidia.com/feed/", a: "NVIDIA Blog", av: "auto", t: "official", tags: ["Developers"], topic: "Industry AI" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/", a: "AWS ML Blog", av: "auto", t: "official", tags: ["Developers"], topic: "Tools" },
  { url: "https://deepmind.google/blog/rss.xml", a: "Google DeepMind", av: "auto", t: "official", tags: ["Everyone"], topic: "Models" },
  { url: "https://tldr.tech/api/rss/ai", a: "TLDR AI", av: "auto", t: "voice", tags: ["Everyone"], topic: "Models" },
  { url: "https://news.smol.ai/rss.xml", a: "AI News (smol.ai)", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://emerj.com/feed/", a: "Emerj", av: "auto", t: "voice", tags: ["Marketing & Sales", "Product Managers"], topic: "Adoption" },
  { url: "https://www.answer.ai/index.xml", a: "Answer.AI", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://www.fast.ai/index.xml", a: "fast.ai", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://www.kdnuggets.com/feed", a: "KDnuggets", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://rss.arxiv.org/rss/cs.AI", a: "arXiv cs.AI", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://research.google/blog/rss/", a: "Google Research", av: "auto", t: "official", tags: ["Developers"], topic: "Models" },
  { url: "https://huggingface.co/blog/feed.xml", a: "Hugging Face", av: "auto", t: "official", tags: ["Developers"], topic: "Models" },
  { url: "https://machinelearning.apple.com/rss.xml", a: "Apple ML Research", av: "auto", t: "official", tags: ["Developers"], topic: "Models" },
  { url: "https://stackoverflow.blog/feed/", kw: "title", a: "Stack Overflow Blog", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools" },
  { url: "https://github.blog/changelog/feed/", a: "GitHub Changelog", av: "auto", t: "official", tags: ["Developers"], topic: "Tools" },
  { url: "https://feed.infoq.com/ai-ml-data-eng/", a: "InfoQ AI/ML", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://thenewstack.io/feed/", kw: "title", a: "The New Stack", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools" },
  { domain: true, url: "https://semiengineering.com/feed/", kw: "title", who: "Semiconductor & industrial electronics", a: "Semiconductor Engineering", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  { w: -2, url: "https://www.quantamagazine.org/feed/", kw: "title", a: "Quanta Magazine", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://hnrss.org/newest?q=AI+manufacturing", a: "Hacker News · AI x mfg", av: "auto", t: "voice", tags: ["Developers"], topic: "Industry AI" },
  { url: "https://www.reddit.com/r/MachineLearning/.rss", a: "r/MachineLearning", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { domain: true, url: "https://www.eetimes.com/feed/", kw: "title", who: "Electronics industry news", a: "EE Times", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI" },
  /* Magestic-industry topical news (Google News RSS queries) */
  { url: "https://www.bing.com/news/search?q=AI%20%22sheet%20metal%22%20fabrication&format=rss", a: "AI in Sheet Metal", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists", "Developers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=AI%20CNC%20machining&format=rss", a: "AI in CNC & Machining", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=composites%20manufacturing%20AI%20aerospace&format=rss", a: "AI in Composites", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22CAM%20software%22%20OR%20%22nesting%20software%22%20AI&format=rss", a: "CAM & Nesting Software News", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22smart%20factory%22%20aerospace%20OR%20defense&format=rss", a: "Smart Factory · Aero & Defense", av: "auto", t: "industry", tags: ["Marketing & Sales", "Product Managers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22generative%20design%22%20OR%20%22AI%20toolpath%22%20manufacturing&format=rss", a: "Generative Design & AI CAM", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22material%20utilization%22%20OR%20%22material%20yield%22%20manufacturing&format=rss", a: "Material Yield & Optimization", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", max: 2 },
  /* Company video channels (YouTube RSS; thumbnails render in the feed) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA", a: "Anthropic (video)", who: "Official Anthropic channel · agent & Claude Code deep dives", av: "anthropic", t: "official", tags: ["Everyone", "Developers"], topic: "Tools", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 8, w: 3 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A", a: "OpenAI (video)", who: "Official OpenAI channel · developer sessions & demos", av: "openai", t: "official", tags: ["Everyone", "Developers"], topic: "Tools", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 8, w: 3 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A", a: "Google DeepMind (video)", who: "Official DeepMind channel · research explainers", av: "google", t: "official", tags: ["Everyone"], topic: "Models", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC9IEkprr46ScglWU79HF5qQ", a: "Boeing (video)", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJWcF0ex7_doPdIQGbVpDsQ", a: "Lockheed Martin (video)", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYR5Kgzn6suihs56iJ8_vfw", a: "Siemens Software (video)", av: "siemens", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCaEEm-0s0x3MHg9jzFcHuQQ", a: "Siemens (video)", av: "siemens", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCL-g3eGJi1omSDSz48AML-g", a: "NVIDIA (video)", av: "auto", t: "official", tags: ["Developers", "Marketing & Sales"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJ1cS4hALCDHPnygfv6VOhQ", a: "Airbus (video)", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCD98uquOUa1kKSdcHgCKEXA", a: "Autodesk (video)", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  /* Magestic-niche industry press (verified Jul 17 2026) */
  { w: 4, url: "https://develop3d.com/feed/", a: "Develop3D", who: "CAD/CAM & product development magazine", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.engineering.com/feed/", a: "Engineering.com", who: "Engineering technology news", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://breakingdefense.com/feed/", a: "Breaking Defense", who: "Defense industry & procurement news", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://spacenews.com/feed/", a: "SpaceNews", who: "Space industry business news", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/industry/?outputType=xml", a: "Defense News · Industry", who: "Defense industrial base coverage", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.navalnews.com/feed/", a: "Naval News", who: "Naval shipbuilding & defense (Electric Boat's world)", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.marinelog.com/feed/", a: "MarineLog", who: "Shipbuilding & marine industry news", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://www.offshorewind.biz/feed/", a: "OffshoreWind.biz", who: "Wind energy industry (Vestas/TPI's world)", av: "auto", t: "industry", tags: ["Marketing & Sales"], topic: "Industry AI", kw: true, max: 1 },
  { domain: true, url: "https://www.roboticstomorrow.com/rss/news.xml", a: "Robotics Tomorrow", who: "Industrial robotics & automation news", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { w: 2, url: "https://www.fabricatingandmetalworking.com/feed/", a: "Fabricating & Metalworking", who: "Metal fabrication industry magazine", av: "auto", t: "industry", tags: ["Application Specialists", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { w: 2, url: "https://www.jeccomposites.com/feed/", a: "JEC Composites", who: "The composites industry's global trade body", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.aerospacetestinginternational.com/feed", a: "Aerospace Testing Intl", who: "Aerospace test & certification tech", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://www.etmm-online.com/rss/news.xml", a: "ETMM", who: "European toolmaking & mould making", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://metrology.news/feed/", a: "Metrology News", who: "Precision measurement & inspection tech", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  /* Developer education & industry video channels */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCLKPca3kwwd-B59HNr-_lvA", a: "AI Engineer (video)", who: "AI Engineer conference talks · agents, harnesses, evals", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXUPKJO5MZQN11PqgIvyuvQ", a: "Andrej Karpathy (video)", who: "Deep technical LLM education from first principles", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Models", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw", a: "Google for Developers (video)", who: "Official Google developer channel", av: "google", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJS9pqu9BzkAMNTmzNMNhvg", a: "Google Cloud Tech (video)", who: "Cloud + AI engineering sessions", av: "google", t: "official", tags: ["Developers", "Database Engineers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsMica-v34Irf9KVTh6xx-g", a: "Microsoft Developer (video)", who: "Official Microsoft developer channel · Copilot & M365 dev", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC7c3Kb6jYCRj4JOHHZTxKsQ", a: "GitHub (video)", who: "Official GitHub channel · Copilot & agentic workflows", av: "github", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6YYHJzM6PhZ2Yey9BQiUaw", a: "Cursor (video)", who: "Official Cursor channel · AI-native coding", av: "cursor", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZsiZ9RIRtzpoToh4noauAw", a: "TRUMPF (video)", who: "Machine OEM incumbent · punching & laser tech", av: "auto", t: "industry", tags: ["Application Specialists", "Marketing & Sales"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw", a: "3Blue1Brown (video)", who: "Visual math of neural networks · evergreen education", av: "auto", t: "voice", tags: ["Developers", "Everyone"], topic: "Models", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", a: "Two Minute Papers (video)", who: "AI research explained in minutes", av: "auto", t: "voice", tags: ["Everyone"], topic: "Models", vid: true, max: 1 },
  /* Instructional AI-dev channels (video; how to actually use Claude Code, Codex, agents) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA", a: "Fireship", who: "Fast, sharp dev explainers (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1, kw: true },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC8butISFwT-Wl7EV0hUK0BQ", a: "freeCodeCamp", who: "Free full-length programming courses (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1, kw: true },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCcIXc5mJsHVYTZR1maL5l9w", a: "DeepLearning.AI (video)", who: "Andrew Ng's courses and AI interviews", av: "auto", t: "voice", tags: ["Developers", "Product Managers"], topic: "Tools", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x36zCEGilGpB1m-V4gmjg", a: "IndyDevDan", who: "Agentic coding workflows: Claude Code in practice (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCMwVTLZIRRUyyVrkjDpn4pA", a: "Cole Medin", who: "AI agent build tutorials (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCswG6FSbgZjbWtdf_hMLaow", a: "Matt Pocock (video)", who: "AI Hero: hands-on AI engineering training", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UChpleBmo18P08aKCIgti38g", a: "Matt Wolfe (video)", who: "Weekly AI tools roundup", av: "auto", t: "voice", tags: ["Everyone"], topic: "Tools", vid: true, max: 1 },
  /* Leading AI dev-tool vendors: news & tutorials (video, 1 slot each; Claude Code + Codex stay the majority) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6YYHJzM6PhZ2Yey9BQiUaw", a: "Cursor (video)", who: "Official Cursor channel", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCo2ri0cvAs8Lxbp18UHZsgg", a: "xAI (video)", who: "Official xAI channel · Grok", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCTSqI4c58ffN6l5Mbdat6dg", a: "Perplexity (video)", who: "Official Perplexity channel", av: "auto", t: "official", tags: ["Everyone"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCirYnEfIjR8L1-sM2ozb7QQ", a: "Windsurf (video)", who: "Official Windsurf channel · agentic IDE", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCgoJjdR6-7AMu9fDitb6nVw", a: "Replit (video)", who: "Official Replit channel · Agent", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCk_Il3HoK3qTz1tvzyphozg", a: "Cognition (video)", who: "Official Cognition channel · Devin", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCRaz_dquopKtb4ptswKcxTA", a: "Mistral AI (video)", who: "Official Mistral channel · Codestral/Devstral", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCT-nPlVzJI-ccQXlxjSvJmw", a: "AWS Developers (video)", who: "Official AWS dev channel · Q/Kiro", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGp4UBwpTNegd_4nCpuBcow", a: "JetBrains (video)", who: "Official JetBrains channel · Junie/AI Assistant", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 1 },
  /* AI Workflow Playbooks — the heaviest-weighted lanes on the hub: how practitioners actually
     use these tools day to day (Anthropic/OpenAI engineer workflow breakdowns, agentic-coding
     techniques, prompting/context-engineering guides). Simple queries — Bing drops complex ORs. */
  { w: 10, url: "https://www.bing.com/news/search?q=%22Claude%20Code%22%20workflow&format=rss", a: "AI Workflow Playbooks", who: "How practitioners actually work with AI — workflows, playbooks, techniques", av: "anthropic", t: "official", tags: ["Developers", "Everyone"], topic: "Tools", max: 3 },
  { w: 10, url: "https://www.bing.com/news/search?q=%22agentic%20coding%22&format=rss", a: "AI Workflow Playbooks", who: "How practitioners actually work with AI — workflows, playbooks, techniques", av: "anthropic", t: "official", tags: ["Developers", "Everyone"], topic: "Tools", max: 3 },
  { w: 10, url: "https://www.bing.com/news/search?q=%22prompt%20engineering%22&format=rss", a: "AI Workflow Playbooks", who: "How practitioners actually work with AI — workflows, playbooks, techniques", av: "anthropic", t: "official", tags: ["Developers", "Everyone"], topic: "Tools", max: 2 },
  { w: 10, url: "https://www.bing.com/news/search?q=%22context%20engineering%22&format=rss", a: "AI Workflow Playbooks", who: "How practitioners actually work with AI — workflows, playbooks, techniques", av: "anthropic", t: "official", tags: ["Developers", "Everyone"], topic: "Tools", max: 2 },
  /* AI dev-tool news lane (Bing News; direct links + thumbnails) */
  { url: "https://www.bing.com/news/search?q=%22Claude%20Code%22&format=rss", a: "Claude Code News", who: "News about Claude Code", av: "anthropic", t: "official", tags: ["Developers"], topic: "Tools", max: 3, w: 5 },
  { url: "https://www.bing.com/news/search?q=%22OpenAI%20Codex%22&format=rss", a: "Codex News", who: "News about OpenAI Codex", av: "openai", t: "official", tags: ["Developers"], topic: "Tools", max: 3, w: 5 },
  { url: "https://www.bing.com/news/search?q=%22Cursor%22%20AI%20editor&format=rss", a: "Cursor News", who: "News about the Cursor IDE", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22GitHub%20Copilot%22&format=rss", a: "Copilot News", who: "News about GitHub Copilot", av: "github", t: "official", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Gemini%20CLI%22%20OR%20%22Gemini%20Code%20Assist%22&format=rss", a: "Gemini Dev News", who: "News about Google's coding tools", av: "google", t: "official", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Devin%22%20Cognition%20AI&format=rss", a: "Devin News", who: "News about Cognition's Devin", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Grok%22%20xAI%20developer&format=rss", a: "Grok News", who: "News about xAI's Grok for developers", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Perplexity%22%20AI&format=rss", a: "Perplexity News", who: "News about Perplexity", av: "auto", t: "industry", tags: ["Everyone"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=Aider%20OR%20Cline%20OR%20OpenHands%20coding%20agent&format=rss", a: "Open-Source Agents News", who: "News on open-source coding agents", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  /* Industry video: what OEMs, peers & trade media are doing with AI (AI-filtered) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC09R-RDOwz88FqD--3YWmew", a: "MTDCNC (video)", who: "CNC industry video network", av: "auto", t: "industry", tags: ["Application Specialists", "Developers"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZsiZ9RIRtzpoToh4noauAw", a: "TRUMPF (video)", who: "Official TRUMPF channel · punch/laser OEM", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCc2lUKVOTXKlQR7Fm7h1JfQ", a: "Titans of CNC (video)", who: "Machining education powerhouse", av: "auto", t: "industry", tags: ["Application Specialists", "Developers"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCi-1bvDwzwBq0OFKiF2atkg", a: "Haas Automation (video)", who: "Official Haas CNC channel", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCE_crBpIk_NtYb_6AbLA5Cw", a: "Machina Labs (video)", who: "AI-native robotic forming · direct AI competitor class", av: "auto", t: "industry", tags: ["Marketing & Sales", "Developers"], topic: "Industry AI", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCvFJMO2exEwenV_TZHwBl6g", a: "Okuma (video)", who: "Official Okuma CNC channel", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  /* Conference watch: JEC World & FABTECH — the shows where our whole market exhibits */
  { url: "https://www.bing.com/news/search?q=%22JEC%20World%22%20OR%20%22JEC%20Composites%22&format=rss", a: "JEC World Watch", who: "Composites' global trade show · exhibitor & AI news", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22FABTECH%22%20metal%20fabrication&format=rss", a: "FABTECH Watch", who: "North America's largest metal forming/fabricating show", av: "auto", t: "industry", tags: ["Marketing & Sales", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=(%22JEC%22%20OR%20%22FABTECH%22%20OR%20%22IMTS%22)%20AI%20exhibitor&format=rss", a: "Trade Show AI Watch", who: "AI announcements from industry trade shows", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 2 },
];

const strip = (s = "") =>
  s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#0?39;|&apos;/g, "'")
   .replace(/&quot;/g, '"')
   .replace(/<[^>]+>/g, " ")   // second pass: tags reconstituted by entity decoding
   .replace(/\s+/g, " ").trim();

function items(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const g = (re) => (b.match(re) || [])[1] || "";
    const title = strip(g(/<title[^>]*>([\s\S]*?)<\/title>/));
    let link = g(/<link[^>]*href="([^"]+)"[^>]*\/?>/) || strip(g(/<link[^>]*>([\s\S]*?)<\/link>/));
    const date = g(/<pubDate>([\s\S]*?)<\/pubDate>/) || g(/<updated>([\s\S]*?)<\/updated>/) || g(/<published>([\s\S]*?)<\/published>/);
    const rawDesc = g(/<description[^>]*>([\s\S]*?)<\/description>/) || g(/<summary[^>]*>([\s\S]*?)<\/summary>/) || "";
    const desc = strip(rawDesc).slice(0, 260);
    const bimg = strip(g(/<News:Image>([\s\S]*?)<\/News:Image>/));
    const img = bimg || g(/<media:thumbnail[^>]*url="([^"]+)"/) || g(/<media:content[^>]*url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
                g(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/) || g(/<enclosure[^>]*url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
                (rawDesc.match(/&lt;img[^&]*src=&quot;([^&]+?)&quot;/) || rawDesc.match(/<img[^>]*src="([^"]+)"/) || [])[1] || "";
    { const bm = link && link.match(/bing\.com\/news\/apiclick\.aspx[^"]*?[?&]url=([^&]+)/i);
      if (bm) { try { link = decodeURIComponent(bm[1]); } catch {} } }
    if (title && link) out.push({ title, link, date: new Date(date || Date.now()), desc, img });
  }
  return out;
}

const MFG_KW = /\b(manufactur|fabricat|factor(?:y|ies)|CNC|machining|machine shop|machinist|composite|prepreg|fiberglass|honeycomb|unidirectional tape|tape laying|fiber placement|AFP|ATL|ply|layup|lay-up|draping|kitting|nesting|nest|aerospace|aviation|defen[cs]e|naval|shipyard|shipbuilding|sheet ?metal|plate cutting|weld|waterjet|plasma cutting|oxy[- ]?fuel|punching|nibbling|press brake|turret|laser cutting|laser projection|CAM|CAD|PLM|MES\b|NC program|post[- ]?processor|toolpath|genetic algorithm|material yield|material utilization|digital thread|digital manufacturing|Industry 4\.0|IIoT|industrial|production line|shop floor|tooling|metalwork|quoting|job shop|wind blade|turbine|generative manufacturing)\b/i;
const companiesSrcEarly = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "companies.js"), "utf8");
const WATCHLIST = new Function(companiesSrcEarly + ";return COMPANIES;")();
const COMPANY_RE = new RegExp("\\b(" + WATCHLIST.map(c => c.n.replace(/\s*\(.*?\)/g, "").trim()).filter(n => n.length > 3)
  .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "i");
const WAR_NOISE = /\b(combat|weapon|missile|warhead|munition|battlefield|kamikaze|drone strike|air defen[cs]e|counter-?UAS|warfare|lethal)\b/i;
/* Practitioner-workflow archetype — the single heaviest boost in the feed. Matches "how engineers
   actually use these tools" content: workflow breakdowns, playbooks, prompting/context engineering,
   agentic-coding techniques (e.g. an Anthropic engineer explaining how to build a system that
   prompts itself). This is the content the hub exists to surface, so it outranks announcements. */
/* NOTE: deliberately does NOT match bare product names (claude code, codex cli) —
   the watch feeds' own subject terms were self-boosting every item +5. */
const WORKFLOW_RE = /\b(workflows?|playbooks?|best practices|how (i|we|to) (use|build|code|work|ship)|prompt engineering|context engineering|prompting (guide|tips|claude|gpt)|agentic (coding|engineering|workflows?)|subagents?|sub-agents?|multi-?agent|mcp servers?|skills? for claude|tips for (using|working with)|prompts itself|engineering with (ai|claude|llms)|coding with (ai|claude|llms)|pair.?programming with)\b/i;
/* Clickbait shapes get demoted, never boosted — listicle bait reads as workflow content
   to the regex above but is exactly what shouldn't lead the team's feed. */
const CLICKBAIT_RE = /\b(you should never|the one (command|trick|prompt|thing|setting)|one (command|trick|prompt) (that|to|you)|this (one|simple) (trick|command|prompt)|will (blow your|shock|change everything)|nobody (tells|talks about)|the secret (to|behind)|what happens when i|i (added|typed) one)\b/i;
/* manufacturing-AI relevance, broader than the strict CORE_KW terms */
const MFG_AI_RE = /\b(predictive maintenance|machine vision|quality inspection|digital twin|smart factory|shop floor|factory floor|CNC|additive manufacturing|3D print(?:ing|ed)?|robotic (?:welding|assembly|inspection)|industrial (?:AI|automation|robots?)|PLM|CAD software|CAM software|generative design|manufacturing (?:AI|software|automation))\b/i;
/* operational/config changes to tools we run — the "admin email" class of news */
const OPS_RE = /\b(auto.?mode|permissions? (mode|change|default)|defaults? (are )?(changing|changed)|deprecat(ed|ion|ing)?|breaking change|end[- ]of[- ]life|sunset(ting)?|pricing (change|update)|now requires?|managed settings|changelog|new default)\b/i;
const norm = (x) => (x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const FIN_NOISE = /\b(stocks?|shares?|share price|earnings|dividend|NYSE|NASDAQ|price target|analyst rating|analysts? (?:say|rate|expect)|market cap|sell-?off|hedge fund|portfolio|52-week|strong buy|strong sell|buy rating|hold rating|undervalued|overvalued|bargain|too cheap|bullish|bearish|rall(?:y|ies)|upgraded?|downgraded?|top \d+ (?:AI )?stocks?|trading|traders?|IPO|ticker)\b|seeking ?alpha|motley ?fool|zacks|benzinga|marketbeat|barchart|insider ?monkey|investing\.com|investor.s business daily|simplywall|thestreet|barron|yahoo finance|24.7 ?wall ?st|cramer|\(NASDAQ|\(NYSE|\(ENXT|stock analysis|wall street|cash burn|investor (?:faith|confidence|concerns?|worr)|valuation/i;
const CORE_KW = /\b(nest(?:ing|s)?|punch(?:ing|es)?|nibbling|bin[- ]?packing|packing optimi|composite|prepreg|ply|layup|lay-up|draping|kitting|AFP|ATL|fiber placement|tape laying|honeycomb|sheet ?metal|TruLaser|TruTops|laser projection|laser cutting|laser templat|LPT|waterjet|plasma cutting|press brake|turret|CAM\b|CAD\b|toolpath|NC program|post[- ]?processor|material (?:yield|utilization)|cutting path|fabricat)\b/i;
const OFFTOPIC = /\b(supply chain|logistics|warehous(?:e|ing)|procurement|freight|shipping|inventory management|webinar|register now)\b/i;
const AI_KW = /\b(AI|A\.I\.|artificial intelligence|machine[- ]learning|deep learning|computer vision|digital twin|generative|GenAI|copilot|smart factory|neural|LLM|large language|GPT-?\d*|Claude|Gemini|Codex|agentic|autonomous)\b/i;

const posts = [];
for (const f of FEEDS) {
  try {
    const res = await fetch(f.url, { headers: { "user-agent": "MagesticAIHub/1.0 (+github pages feed refresh)" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    let feedItems = items(xml);
    if (f.t === "industry" && !f.kw) f.kw = true; // ALL publication-type sources are AI-filtered, any topic
    if (f.skip) feedItems = feedItems.filter(i => !f.skip.test(i.title));
    if (f.kw) feedItems = feedItems.filter(i => AI_KW.test(f.kw === "title" ? i.title : i.title + " " + i.desc));
    if (f.domain) feedItems = feedItems.filter(i => MFG_KW.test(i.title + " " + i.desc) || COMPANY_RE.test(i.title + " " + i.desc));
    if (f.topic === "Industry AI") feedItems = feedItems.filter(i => !OFFTOPIC.test(i.title + " " + i.desc) || CORE_KW.test(i.title + " " + i.desc));
    if (/bing\.com|news\.google/.test(f.url)) feedItems = feedItems.filter(i => !FIN_NOISE.test(i.title + " " + i.desc + " " + i.link));
    if (f.prefer) feedItems = [...feedItems.filter(i => f.prefer.test(i.title)), ...feedItems.filter(i => !f.prefer.test(i.title))];
    for (const it of feedItems.slice(0, f.max || DEFAULT_PER_FEED)) {
      const wt = (f.w || 0) + (CORE_KW.test(it.title + " " + it.desc) ? 4 : 0)
        + ((f.topic === "Tools" && (f.vid || (f.tags || []).includes("Developers"))) ? 2 : 0) + (f.vid ? 1 : 0)
        + (f.topic === "Industry AI" ? 1 : 0)
        /* any story naming a watchlist company (customer, partner, or competitor) ranks higher */
        + (COMPANY_RE.test(it.title) ? 3 : 0)
        /* practitioner workflow/playbook content is the heaviest-weighted archetype on the hub */
        + (WORKFLOW_RE.test(it.title) ? 5 : (WORKFLOW_RE.test(it.desc || "") ? 2 : 0))
        /* operational changes to tools the team runs (permission defaults, deprecations,
           pricing, breaking changes) are must-see news and outrank ordinary coverage */
        + ((f.t === "official" && OPS_RE.test(it.title + " " + (it.desc || ""))) ? 4 : 0)
        + (MFG_AI_RE.test(it.title + " " + (it.desc || "")) ? 2 : 0)
        - (CLICKBAIT_RE.test(it.title) ? 6 : 0);
      posts.push({
        a: f.a, s: f.who || `via ${new URL(f.url).hostname}`, av: f.av, t: f.t,
        ...(wt ? { w: wt } : {}),
        d: it.date.toISOString().slice(0, 10),
        when: it.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        body: `${it.title}${it.desc && !norm(it.desc).startsWith(norm(it.title).slice(0, 50)) ? "\n\n" + it.desc + "…" : ""}`,
        tags: f.tags, topic: f.topic,
        ...(it.img ? { img: it.img } : {}), ...(f.vid ? { vid: true } : {}),
        link: { u: it.link, b: it.title.slice(0, 90), s: new URL(it.link).hostname },
      });
    }
    console.log(`ok   ${f.a} (${f.url})`);
  } catch (e) {
    console.warn(`skip ${f.a}: ${e.message}`);
  }
}


/* ---- Company Watch: Google News pull for every company in data/companies.js ----
   The 38 priority companies (p:1) are fetched on every run. The other 262 rotate in slices
   of 70, and the slice index is keyed on the UTC hour: ceil(262/70) = 4 slices, so it is
   (UTC hour % 4). With the workflow running every 10 minutes, each hour's runs re-poll one
   slice ~6x, and the full 300-company watchlist cycles every 4 hours.
   Note: the slice tracks the clock, not a run counter, so changing the refresh cadence
   changes how often each slice is revisited but never leaves a slice unvisited. */
const COMPANIES = WATCHLIST;
const coQ = (c) => { const co = typeof c === "string" ? { n: c } : c; return co.q || ('"' + co.n.replace(/\s*\(.*?\)/g, "") + '" AI (manufacturing OR production OR factory OR engineering OR software)'); };
const gnUrl = (c) => `https://news.google.com/rss/search?q=${encodeURIComponent(coQ(c))}&hl=en-US&gl=US&ceid=US:en`;
const bingUrl = (c) => `https://www.bing.com/news/search?q=${encodeURIComponent(coQ(c))}&format=rss`;
const prio = COMPANIES.filter(c => c.p);
const rest = COMPANIES.filter(c => !c.p);
const slice = Math.floor(new Date().getUTCHours() / 1) % Math.ceil(rest.length / 70);
const batch = [...prio, ...rest.slice(slice * 70, slice * 70 + 70)];
console.log(`company watch: ${prio.length} priority + ${batch.length - prio.length} rotating (slice ${slice})`);
const companyPosts = [];
async function pullCompany(c) {
  try {
    let its = [];
    try {
      const rb = await fetch(bingUrl(c), { headers: { "user-agent": "Mozilla/5.0 (MagesticAIHub feed refresh)" }, signal: AbortSignal.timeout(15000) });
      if (rb.ok) its = items(await rb.text());
    } catch {}
    if (!its.length) {
      const res = await fetch(gnUrl(c), { headers: { "user-agent": "Mozilla/5.0 (MagesticAIHub feed refresh)" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return;
      its = items(await res.text());
    }
    if (c.bad) { const badRe = new RegExp(c.bad, "i"); its = its.filter(i => !badRe.test(i.title + " " + i.desc + " " + i.link)); }
    its = its.filter(i => AI_KW.test(i.title + " " + i.desc) && !FIN_NOISE.test(i.title + " " + i.desc + " " + i.link)
      && (!WAR_NOISE.test(i.title + " " + i.desc) || MFG_KW.test(i.title + " " + i.desc))
      && (!OFFTOPIC.test(i.title + " " + i.desc) || CORE_KW.test(i.title + " " + i.desc)));
    const cutoff = Date.now() - 14 * 86400000; // only news from the last 2 weeks
    for (const it of its.filter(i => i.date.getTime() > cutoff).slice(0, c.p ? 4 : 2)) {
      companyPosts.push({
        a: c.n, s: `Company Watch · ${c.side === "s" ? "competitor/supplier" : "customer/market"}${c.score != null ? ` · AI ${c.score}/10` : ""}`,
        av: "auto", t: "industry",
        d: it.date.toISOString().slice(0, 10),
        when: it.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        body: it.title + (it.desc && !norm(it.desc).startsWith(norm(it.title).slice(0, 50)) ? "\n\n" + it.desc + "…" : ""), tags: ["Marketing & Sales", "Product Managers"], topic: "Company Watch",
        /* Company Watch ranks high but must compete: priority accounts and competitors get a
           boost, and industry-core relevance (nesting/composites/CAM terms) is the strongest
           single signal — a composites-relevant competitor story still tops the feed (~8),
           but generic watchlist chatter no longer wallpapers it. */
        w: (c.p ? 5 : 4) + (c.side === "s" ? 1 : 0) + ((c.score || 0) / 10) + (CORE_KW.test(it.title + " " + it.desc) ? 2 : 0) - (c.noisy && !CORE_KW.test(it.title + " " + it.desc) ? 2 : 0),
        ...(it.img ? { img: it.img } : {}),
        link: { u: it.link, b: it.title.slice(0, 90), s: (()=>{try{return new URL(it.link).hostname}catch{return "news"}})() },
      });
    }
  } catch { /* skip quietly */ }
}
for (let i = 0; i < batch.length; i += 10) {
  await Promise.all(batch.slice(i, i + 10).map(pullCompany));
}
companyPosts.sort((x, y) => y.d.localeCompare(x.d));
const companyTop = companyPosts.slice(0, MAX_COMPANY_ITEMS);
console.log(`company watch: ${companyTop.length} items`);

posts.sort((x, y) => y.d.localeCompare(x.d));
/* ---- og:image enrichment: fetch article pages for posts still missing media ---- */
const generalTop = posts.slice(0, MAX_TOTAL);
const vidPosts = posts.filter(p => p.vid && !generalTop.includes(p));
const allPosts = [...generalTop, ...vidPosts, ...companyTop];
const needImg = allPosts.filter(p => !p.img && p.link && !/news\.google/.test(p.link.u)).slice(0, 100);
async function enrich(p) {
  try {
    const res = await fetch(p.link.u, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36" }, signal: AbortSignal.timeout(9000), redirect: "follow" });
    if (!res.ok) return;
    const html = (await res.text()).slice(0, 300000);
    const m = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
              html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i) ||
              html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i);
    if (m && /^https?:\/\//.test(m[1])) p.img = m[1].replace(/&amp;/g, "&");
  } catch { /* leave imageless */ }
}
for (let i = 0; i < needImg.length; i += 12) {
  await Promise.all(needImg.slice(i, i + 12).map(enrich));
}
/* ---- enforce media-rich feed: imageless posts capped at ~20% ---- */
/* enforce ~50/50 split: industry news vs AI training/news */
const isIndPost = (p) => p.topic === "Industry AI" || p.topic === "Company Watch" || p.topic === "Regulatory";
let indSide = allPosts.filter(isIndPost);
let aiSide = allPosts.filter(p => !isIndPost(p));
/* favor industry ~60/40: industry keeps up to 1.6x the base, AI side up to 1.1x */
const base = Math.min(indSide.length, aiSide.length);
indSide = indSide.slice(0, Math.ceil(base * 1.8)); aiSide = aiSide.slice(0, Math.ceil(base * 1.1));
console.log(`mix: ${indSide.length} industry vs ${aiSide.length} AI training/news`);
const balanced = [...indSide, ...aiSide];
const withImg = balanced.filter(p => p.img);
const noImg = balanced.filter(p => !p.img);
const keepNoImg = noImg.filter(p => p.t === "internal"); // every live post carries an image or video
const finalPosts = [...withImg, ...keepNoImg].sort((x, y) => y.d.localeCompare(x.d));
console.log(`media coverage: ${withImg.length}/${finalPosts.length} posts have image or video (${Math.round(100*withImg.length/finalPosts.length)}%)`);
const top = finalPosts;

/* ---- accumulate: merge with previous feed so the archive grows ~25-50 posts/day ---- */
let previous = [];
try { previous = new Function(readFileSync(OUT, "utf8") + ";return POSTS_LIVE;")(); } catch {}
/* normalize archive links BEFORE dedupe so old bing-redirect URLs match their unwrapped versions */
const unwrapLink = (p) => {
  if (p.link && /bing\.com\/news\/apiclick/.test(p.link.u)) {
    const bm = p.link.u.match(/[?&]url=([^&]+)/);
    if (bm) { try { p.link.u = decodeURIComponent(bm[1]); p.link.s = new URL(p.link.u).hostname; } catch {} }
  }
};
previous.forEach(unwrapLink);
const keyOf = (p) => (p.link && p.link.u) || p.body.slice(0, 80);
const titleOf = (p) => norm((p.link && p.link.b) || p.body.split("\n")[0]).slice(0, 60);
const seenKeys = new Set(finalPosts.map(keyOf));
const seenTitles = new Set(finalPosts.map(titleOf));
const carried = previous.filter(p => !seenKeys.has(keyOf(p)) && !seenTitles.has(titleOf(p)))
  .filter(p => p.t === "internal" || p.vid || p.topic === "Regulatory" || AI_KW.test(p.a + " " + p.body))
  .filter(p => !FIN_NOISE.test(p.body) && (!OFFTOPIC.test(p.body) || CORE_KW.test(p.body)));
/* final dedupe by URL and by normalized title — the same story syndicated at two URLs
   (e.g. msn.com vs the original publisher) collapses to one post */
const mergedAll = [...finalPosts, ...carried].sort((x, y) => y.d.localeCompare(x.d));
const dedupSeen = new Set(), dedupTitles = new Set(), mergedDedup = [];
for (const p of mergedAll) {
  const k = keyOf(p), t = titleOf(p);
  if (dedupSeen.has(k) || (t && t.length > 10 && dedupTitles.has(t))) continue;
  dedupSeen.add(k); if (t) dedupTitles.add(t);
  mergedDedup.push(p);
}
const merged = mergedDedup.filter(p => !p._drop).slice(0, 400);
/* upgrade thumbnail resolution everywhere (including carried archive items):
   Bing th endpoint honors w/qlt params; YouTube maxresdefault is 1280x720 (frontend falls back if missing) */
const upImg = (u) => {
  if (!u) return u;
  // c=7 (smart crop) + fixed 16:9 box makes Bing crop-fill server-side instead of
  // serving letterboxed thumbs with white bars baked into the JPEG.
  if (/bing\.com\/th\?/.test(u)) return u.replace(/&(w|h|qlt|c|rs)=\d+/g, "") + "&w=1200&h=675&c=7&rs=1&qlt=90";
  if (/ytimg\.com\/vi\//.test(u)) return u.replace(/\/(hqdefault|mqdefault|sddefault|default)\.jpg/, "/maxresdefault.jpg");
  return u;
};
merged.forEach(p => {
  /* paywalled teaser posts ("Premium: ..." subscriber-only stubs) are filler — drop
     them everywhere, including carried archive items */
  if (/^premium:/i.test((p.body || "").trim()) || /^premium:/i.test((p.link && p.link.b) || "")) p._drop = true;
  /* retro-demote clickbait carried in the archive with inflated weights */
  const title0 = (p.link && p.link.b) || (p.body || "").split("\n")[0];
  if (CLICKBAIT_RE.test(title0)) p.w = Math.min(p.w || 0, 2);
  if (p.link && /bing\.com\/news\/apiclick/.test(p.link.u)) {
    const bm = p.link.u.match(/[?&]url=([^&]+)/);
    if (bm) { try { p.link.u = decodeURIComponent(bm[1]); p.link.s = new URL(p.link.u).hostname; } catch {} }
  }
  if (p.img) p.img = upImg(p.img);
  if (p.tags) { const seen = new Set(); p.tags = p.tags.map(t => t === "C-Suite" ? "Marketing & Sales" : t).filter(t => !seen.has(t) && seen.add(t)); }
  /* retro-apply the (rebalanced) company-watch weight to carried archive items — set, not
     max, so weight rebalances propagate to the archive instead of old inflation persisting */
  if (p.topic === "Company Watch") {
    const c = WATCHLIST.find(x => x.n === p.a);
    if (c && c.bad && new RegExp(c.bad, "i").test((p.body || "") + " " + (p.link ? p.link.u : ""))) p._drop = true;
    p.w = (c && c.p ? 5 : 4) + (c && c.side === "s" ? 1 : 0) + ((c && c.score || 0) / 10) + (CORE_KW.test(p.body || "") ? 2 : 0) - (c && c.noisy && !CORE_KW.test(p.body || "") ? 2 : 0);
  }
  /* retro-cap the security lane and total weight (boost stacking produced w14-20 outliers) */
  if (p.a === "AI Security & Threat Watch") p.w = Math.min(Math.max(p.w || 0, 8), 8);
  p.w = Math.min(p.w || 0, 10);
});
/* Bing thumbnails are upscaled from tiny sources — replace with the article's full-res og:image.
   60 per run, so the whole archive upgrades over a few refreshes. */
const lowres = merged.filter(p => p.img && /bing\.com\/th\?/.test(p.img) && p.link && !/news\.google/.test(p.link.u)).slice(0, 100);
for (let i = 0; i < lowres.length; i += 12) {
  await Promise.all(lowres.slice(i, i + 12).map(enrich));
}
console.log(`hi-res upgrade: attempted ${lowres.length} bing-thumbnail posts`);
merged.forEach(p => { if (p.img) p.img = upImg(p.img); }); // re-normalize any og images that are themselves bing thumbs
console.log(`archive: ${finalPosts.length} fresh + ${carried.length} carried = ${merged.length} total`);

const publish = merged.filter(p => !p._drop);
publish.forEach(p => { delete p._drop; });
/* Arrival timestamp: posts only carry a date, so without this the order inside a
   day is stable across refreshes and the top of "Newest first" never changes.
   Items keep their ts once stamped (carried through the archive); only genuinely
   new items get the current run's time. */
const RUN_TS = new Date().toISOString();
publish.forEach(p => { if (!p.ts) p.ts = RUN_TS; });
const banner = `/* AUTO-GENERATED by scripts/update-feed.mjs — do not edit by hand.
   Generated: ${new Date().toISOString()} · ${publish.length} items (rolling archive) from ${FEEDS.length} feeds. */\n`;
writeFileSync(OUT, banner + "const POSTS_LIVE = " + JSON.stringify(publish, null, 1) + ";\nconst FEED_GENERATED = " + JSON.stringify(new Date().toISOString()) + ";\n");
console.log(`wrote ${publish.length} live posts -> data/feed-live.js`);
