window.capacityResearch = {
  "asOf": "2026-09-11",
  "years": [
    "2024",
    "2025",
    "2026F",
    "2027F",
    "2028F"
  ],
  "kgi": [
    {
      "name": "AMZN",
      "fleet": [
        9,
        13,
        18,
        26,
        34
      ],
      "additions": [
        4,
        6,
        8,
        8
      ]
    },
    {
      "name": "GOOGL",
      "fleet": [
        4,
        6,
        11,
        18,
        26
      ],
      "additions": [
        2,
        5,
        7,
        8
      ]
    },
    {
      "name": "MSFT",
      "fleet": [
        5,
        8,
        12,
        16,
        21
      ],
      "additions": [
        3,
        4,
        5,
        5
      ]
    },
    {
      "name": "META",
      "fleet": [
        2,
        4,
        8,
        14,
        21
      ],
      "additions": [
        1,
        4,
        6,
        7
      ]
    }
  ],
  "labs": [
    {
      "name": "Anthropic",
      "rows": [
        [
          "AWS / Trainium",
          1.5,
          2,
          2.8,
          "Assume ~1 GW end-2026 anchor plus another ~1 GW in 2027. Total allocated AWS capacity; no separate Rainier addition.",
          [
            0
          ]
        ],
        [
          "Google / Broadcom / Fluidstack",
          2.3,
          3.5,
          4.5,
          "One combined TPU bucket, including earlier capacity. Partial ramp of 5 GW next-generation program; no separate Fluidstack or historical 1 GW add-on.",
          [
            1,
            2,
            5
          ]
        ],
        [
          "AMD capacity outside other buckets",
          0.4,
          0.8,
          1.2,
          "Assume 0.8 GW from initial 1 GW tranche is available by year-end; reduce if delivered through already-counted cloud allocation.",
          [
            3
          ]
        ],
        [
          "Azure / NVIDIA",
          0.3,
          0.5,
          0.8,
          "Assume half of initial up-to-1 GW commitment is available. Microsoft and NVIDIA counted once.",
          [
            4
          ]
        ],
        [
          "SpaceX",
          0.3,
          0.5,
          0.7,
          "0.3 GW announcement anchor; 0.2 GW additional allocation assumed. Colossus 2 share is not disclosed.",
          [
            1,
            2
          ]
        ],
        [
          "Other existing / incremental",
          0.2,
          0.2,
          0.5,
          "Small residual allowance for capacity outside named buckets; analyst assumption, weak visibility.",
          []
        ]
      ]
    },
    {
      "name": "OpenAI",
      "rows": [
        [
          "Azure + other existing cloud, excluding AWS / Oracle",
          2,
          2.5,
          3,
          "Analyst allocation assumption for legacy and ongoing cloud access. No public GW breakdown; largest baseline uncertainty. Excludes all rows below.",
          []
        ],
        [
          "Oracle / Stargate including Abilene",
          2.5,
          4,
          5,
          "Assume 1.2 GW Abilene plus 2.8 GW of other Oracle buildouts by year-end. Material haircut to >5 GW program; campus and IT definitions are not fully reconciled.",
          [
            6,
            7
          ]
        ],
        [
          "AWS (Trainium + GPU access)",
          0.8,
          1.5,
          2,
          "Assume total AWS allocation reaches 1.5 GW. Trainium and AWS GPU deals share this bucket, not two additions.",
          [
            9
          ]
        ],
        [
          "Other dedicated sites including Milam",
          0.8,
          2,
          3,
          "Assume ~1 GW Milam plus ~1 GW other non-Oracle dedicated deployments. Excludes AWS, Azure, Oracle, PORTS and the residual below; completion and allocation are judgment calls.",
          [
            8,
            10,
            11,
            12
          ]
        ],
        [
          "Cerebras + other incremental neocloud",
          0.4,
          1,
          1.5,
          "Assume ~0.5 GW Cerebras plus ~0.5 GW incremental neocloud outside baseline. Neither allocation is company guidance.",
          [
            13
          ]
        ],
        [
          "PORTS-Pike",
          0,
          0,
          0,
          "First delivery in 2028; excluded from every 2027 case.",
          [
            15
          ]
        ]
      ]
    }
  ],
  "sources": [
    {
      "title": "Anthropic / AWS · 20 Apr 2026",
      "url": "https://www.anthropic.com/news/anthropic-amazon-compute",
      "note": "Up to 5 GW; nearly 1 GW Trainium2/3 by end-2026."
    },
    {
      "title": "Anthropic / Google & SpaceX · 6 May 2026",
      "url": "https://www.anthropic.com/news/higher-limits-spacex",
      "note": "5 GW Google/Broadcom begins in 2027; >0.3 GW Colossus 1 access within May."
    },
    {
      "title": "Anthropic Series H · 28 May 2026",
      "url": "https://www.anthropic.com/news/series-h",
      "note": "Confirms 5 GW TPU agreement and Colossus 2 access, without a GW allocation."
    },
    {
      "title": "AMD / Anthropic · 22 Jul 2026",
      "url": "https://ir.amd.com/news-events/press-releases/detail/1292/amd-and-anthropic-announce-strategic-partnership-to-deploy-up-to-2-gigawatts-of-amd-instinct-mi450-series-gpus",
      "note": "Up to 2 GW; first 1 GW starts deployment H1 2027."
    },
    {
      "title": "Anthropic / Microsoft & NVIDIA · 18 Nov 2025",
      "url": "https://www.anthropic.com/news/microsoft-nvidia-anthropic-announce-strategic-partnerships",
      "note": "Up to 1 GW initial compute commitment; $30B Azure commitment."
    },
    {
      "title": "Broadcom / Fluidstack financing · 9 Jun 2026",
      "url": "https://investors.broadcom.com/news-releases/news-release-details/broadcom-apollo-and-blackstone-establish-landmark-strategic",
      "note": "More than 1 GW previously announced capacity starts mid-2026. Included within TPU exposure here, not added again."
    },
    {
      "title": "OpenAI / Oracle · 22 Jul 2025",
      "url": "https://openai.com/index/stargate-advances-with-partnership-with-oracle/",
      "note": "4.5 GW additional capacity; >5 GW including Abilene under development."
    },
    {
      "title": "Crusoe / Abilene · 27 Mar 2026",
      "url": "https://www.crusoe.ai/resources/newsroom/crusoe-announces-new-900-mw-ai-factory-campus-in-abilene-texas-to-support-microsoft-ai-infrastructure",
      "note": "Existing 1.2 GW campus expected complete end-2026; adjacent 0.9 GW is Microsoft, not automatically OpenAI."
    },
    {
      "title": "OpenAI / SB Energy · 9 Jan 2026",
      "url": "https://openai.com/index/stargate-sb-energy-partnership/",
      "note": "1.2 GW Milam lease; SB Energy initial facilities expected from 2026."
    },
    {
      "title": "OpenAI / Amazon · 27 Feb 2026",
      "url": "https://openai.com/index/amazon-partnership/",
      "note": "2 GW Trainium commitment; multi-year rollout and Trainium4 expected from 2027."
    },
    {
      "title": "OpenAI / NVIDIA · 27 Feb 2026",
      "url": "https://openai.com/index/scaling-ai-for-everyone/",
      "note": "3 GW inference plus 2 GW training collaboration; no complete YE2027 delivery schedule."
    },
    {
      "title": "OpenAI / AMD · 6 Oct 2025",
      "url": "https://openai.com/index/openai-amd-strategic-partnership/",
      "note": "6 GW multi-year agreement; first 1 GW deployment begins H2 2026."
    },
    {
      "title": "OpenAI / Broadcom · 13 Oct 2025",
      "url": "https://openai.com/index/openai-and-broadcom-announce-strategic-collaboration/",
      "note": "10 GW roadmap: start H2 2026, targeted completion end-2029."
    },
    {
      "title": "OpenAI / Cerebras · 14 Jan 2026",
      "url": "https://openai.com/index/cerebras-partnership/",
      "note": "750 MW partnership with phased delivery; 0.5 GW in 2027 is our assumption."
    },
    {
      "title": "OpenAI / Stargate · 29 Apr 2026",
      "url": "https://openai.com/index/building-the-compute-infrastructure-for-the-intelligence-age/",
      "note": "More than 10 GW secured, not all commissioned."
    },
    {
      "title": "OpenAI / PORTS-Pike · 17 Aug 2026",
      "url": "https://openai.com/index/openai-joins-ports-pike-project/",
      "note": "8 GW-IT; first 0.8 GW in 2028. Zero included for 2027."
    }
  ],
  "quarterlyOverrides": {
    "Oracle": {
      "Q3 2026": {
        "value": 0.85,
        "status": "reported",
        "source": "User update, 2026-09-11: ORCL Q3 2026 landed at 0.85 GW."
      },
      "Q2 2026": {
        "value": 0.3,
        "status": "reported",
        "source": "User update, 2026-09-11: ORCL Q2 2026 is 0.3 GW."
      }
    }
  }
};
