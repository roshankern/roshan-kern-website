/**
 * Everything below the hero on the home page, from the CV. Each item is one line
 * (title + summary); `details` and `links` are what its chevron expands to.
 */

import { postsByDate } from "./writing/posts";

export type Link = { label: string; href: string };

export type Item = {
  title: string;
  /** Where the title links, for an item that is a page of its own (a post). */
  href?: string;
  /** Where or what: the lab, company or venue. */
  sub?: string;
  date?: string;
  summary?: string;
  details?: string[];
  links?: Link[];
  /** A figure shown under the item at all times, as wide as the row. */
  image?: { src: string; alt: string; width: number; height: number };
};

export type Section = { id: string; title: string; link?: Link; items: Item[] };

export const INTRO =
  "I use computation to understand and improve biology. I am currently pursuing my PhD in Biological Engineering at MIT. I care deeply about health, technology, and animals.";

// shortcut: Scholar author search, swap for the profile URL (citations?user=...) once known.
const SCHOLAR = "https://scholar.google.com/scholar?q=%22Roshan+Kern%22";

export const SECTIONS: Section[] = [
  {
    id: "projects",
    title: "Projects",
    items: [
      {
        title: "Prior-Weighted Partner Average (PWPA)",
        date: "2026",
        summary: "Predicts the transcriptional response to an unmeasured gene knockdown from the knockdowns measured in the same cell context.",
        details: [
          "Weighs gene-gene priors from many different datasets (gene networks, protein embeddings, CRISPR screens).",
          "Beats [PIE](https://doi.org/10.64898/2026.10.02.756297) (SOTA) on PIE's benchmark (AUPRC 0.325 vs 0.304), with less compute ($0.03 vs $6.43), and is much more interpretable.",
          "Engineered with an autonomous, LLM-driven lab loop of ~580 experiment runs.",
        ],
        links: [{ label: "GitHub", href: "https://github.com/roshankern/prior_weighted_partner_average" }],
        image: {
          src: "/projects/pwpa.png",
          alt: "PWPA overview: priors selected by recursive feature elimination, gates fitted on a weighted partner average, and PWPA against the models in PIE's paper on six metrics",
          width: 2431,
          height: 3151,
        },
      },
      {
        title: "Brieflow",
        date: "2025",
        summary: "Open-source, extensible pipeline for processing optical pooled screen data.",
        details: [
          "Cut screen configuration time by 80% (5 days to 1) and module integration time by 93% (2 weeks to 1 day).",
          "Published in Nature Communications and featured by Anthropic.",
        ],
        links: [
          { label: "GitHub", href: "https://github.com/cheeseman-lab/brieflow" },
          { label: "Anthropic", href: "https://anthropic.com/news/accelerating-scientific-research" },
          { label: "Paper", href: "https://doi.org/10.1038/s41467-026-73643-7" },
        ],
        image: {
          src: "/projects/brieflow.png",
          alt: "Brieflow overview: pooled optical screens, the Brieflow pipeline from preprocessing to clustering, and its codebase",
          width: 1972,
          height: 1742,
        },
      },
      {
        title: "Pycytominer",
        date: "2025",
        summary: "Open-source functions for processing high-dimensional readouts from cell experiments.",
        links: [
          { label: "GitHub", href: "https://github.com/cytomining/pycytominer" },
          { label: "Paper", href: "https://doi.org/10.1038/s41592-025-02611-8" },
        ],
        image: {
          src: "/projects/pycytominer.png",
          alt: "Pycytominer overview: image analysis to image-based profiles, then aggregation, normalization, feature selection and batch correction",
          width: 1515,
          height: 1220,
        },
      },
      {
        title: "IDR Stream",
        date: "2023",
        summary: "Open-source pipeline from Image Data Resource cell images to single-cell features.",
        details: ["Handles downloading, preprocessing, cell segmentation, feature extraction and compilation."],
        links: [{ label: "GitHub", href: "https://github.com/WayScience/IDR_stream" }],
      },
    ],
  },
  {
    id: "education",
    title: "Education",
    items: [
      {
        title: "MIT",
        sub: "Ph.D., Biological Engineering",
        date: "2026 – 2031 (expected)",
        summary: "PhD in Biological Engineering.",
      },
      {
        title: "Case Western Reserve University",
        sub: "B.S., Systems Biology",
        date: "2021 – 2024",
        summary: "B.S. in Systems Biology (Bioinformatics), 4.0 GPA.",
        details: ["Minors in Applied Data Science, Computer Science, and Business Management."],
      },
    ],
  },
  {
    id: "research",
    title: "Research Experience",
    items: [
      {
        title: "MIT, Cheeseman Lab",
        sub: "Research Intern",
        date: "2024 – 2025",
        summary: "Co-developed Brieflow and co-founded the lab's computational team.",
        details: [
          "Massachusetts Life Sciences Center Data Science Internship Program.",
          "Set up project management, code review and computational workflows to make the lab cross-functional.",
          "Co-developed Brieflow for processing optical pooled screen data at scale.",
          "Cut screen configuration time by 80% and module integration time by 93%.",
        ],
      },
      {
        title: "Recursion Pharmaceuticals",
        sub: "Data Science Intern",
        date: "2024",
        summary: "Optimized gene target and compound selection from large-scale phenomic maps.",
        details: [
          "Established a metric for gene target selection from large-scale gene-chemical interactions.",
          "Measured how embeddings from three phenomic maps contribute to compound selection.",
        ],
      },
      {
        title: "Case Western, LaFramboise Lab",
        sub: "Summer Research Fellow",
        date: "2023",
        summary: "Profiled human endogenous retroviruses in bone marrow failure syndromes.",
        details: [
          "Built a pipeline for human endogenous retrovirus profiling from patient transcriptomics.",
          "Presented “Human Endogenous Retrovirus Landscape of Aplastic Anemia” at the CWRU CanSUR Symposium.",
        ],
      },
      {
        title: "CU Anschutz, Way Lab",
        sub: "Research Intern",
        date: "2022 – 2023",
        summary: "Classified single-cell images into 15 phenotypes from morphology features (F1 0.84).",
        details: [
          "Tested how well the model generalizes across cell image datasets.",
          "Developed IDR Stream for extracting features from single-cell images.",
        ],
      },
    ],
  },
  {
    id: "publications",
    title: "Publications",
    link: { label: "Google Scholar", href: SCHOLAR },
    items: [
      {
        title: "Functional genetics reveals a role for the proteasome in regulating centromere assembly",
        sub: "Current Biology (in review)",
        date: "2026",
        summary: "Current Biology, in review.",
        details: ["Marescal O., Su K.-C., Di Bernardo M., Manzer K., He J., Kern R., Cheeseman I.M."],
      },
      {
        title: "The circulating metatranscriptome in acute myeloid leukemia patients: an RNA-seq reanalysis",
        sub: "Frontiers in Microbiomes",
        date: "2026",
        summary: "Frontiers in Microbiomes.",
        details: ["Nguyen A.D.D., Kern R., Dombrovski T., LaFramboise T."],
        links: [{ label: "Paper", href: "https://doi.org/10.3389/frmbi.2026.1903806" }],
      },
      {
        title: "Brieflow: an integrated computational pipeline for high-throughput analysis of optical pooled screening data",
        sub: "Nature Communications",
        date: "2026",
        summary: "Nature Communications.",
        details: ["Di Bernardo M., Kern R., Cepeda Diaz A.K., Mallar A., Choi S.J., Nutter-Upham A., Lourido S., Blainey P.C., Cheeseman I.M."],
        links: [{ label: "Paper", href: "https://doi.org/10.1038/s41467-026-73643-7" }],
      },
      {
        title: "Reproducible image-based profiling with Pycytominer",
        sub: "Nature Methods",
        date: "2025",
        summary: "Nature Methods.",
        details: ["Serrano E., Chandrasekaran S.N., … Kern R., … Singh S., Way G.P."],
        links: [{ label: "Paper", href: "https://doi.org/10.1038/s41592-025-02611-8" }],
      },
      {
        title: "Toward generalizable phenotype prediction from single-cell morphology representations",
        sub: "BMC Methods",
        date: "2024",
        summary: "BMC Methods, co-first author.",
        details: ["Tomkinson J.*, Kern R.*, Mattson C., Way G.P. (*co-first authors)"],
        links: [{ label: "Paper", href: "https://doi.org/10.1186/s44330-024-00014-3" }],
      },
    ],
  },
  {
    id: "writing",
    title: "Writing",
    // every post in app/writing/posts.ts, newest first, at its existing URL
    items: postsByDate().map((p) => ({
      title: p.title,
      href: `/writing/${p.slug}`,
      date: p.date.slice(0, 4),
      summary: p.description || undefined,
    })),
  },
  {
    id: "awards",
    title: "Awards",
    items: [
      { title: "MIT Prize for Open Data", date: "2026", summary: "For Brieflow." },
      { title: "MIT Presidential Fellowship", date: "2026" },
      { title: "Telora Fellowship", date: "2026", summary: "$50k and mentorship to start a company." },
      { title: "Case Alumni Association Junior Senior Scholar", date: "2024" },
      { title: "Dean's High Honors List", date: "2024", summary: "Case Western Reserve University." },
      { title: "Cancer-focused Summer Undergraduate Research Fellowship", date: "2023", summary: "Case Western Reserve University." },
    ],
  },
  {
    id: "other",
    title: "Other Experience",
    items: [
      {
        title: "Telora Fellowship",
        sub: "Fellow",
        date: "2026",
        summary: "Interviewed ~100 people a week to find problems worth building a company around.",
        details: ["Fractional COO for legal tech startup Hourglass ($250k ARR, 25% MoM growth)."],
        links: [{ label: "Hourglass", href: "https://hourglass.law/" }],
      },
      {
        title: "Nucleate Boston",
        sub: "Co-Director of Strategy and Operations",
        date: "2025",
        summary: "Ran a workshop series for early-stage biotech founders in an equity-free accelerator.",
        details: ["Recruited industry mentors and sponsors for the series."],
      },
      {
        title: "Campus Flavor",
        sub: "Project Lead",
        date: "2023",
        summary: "Led two developers building a site for student merchandise designs.",
        details: ["Received 32 student designs in the competition's first two weeks."],
      },
      {
        title: "Saturday Tutoring Program",
        sub: "Tutor",
        date: "2023",
        summary: "Tutored middle schoolers in biology, chemistry, and physics.",
      },
      {
        title: "Animal Protective League",
        sub: "Dog Walker",
        date: "2023",
        summary: "Walked and played with dogs at the shelter.",
      },
      {
        title: "MedWish",
        sub: "Member",
        date: "2022 – 2023",
        summary: "Sorted donated medical supplies for areas in need.",
        details: ["Led eight novice programmers in building the club's website."],
      },
    ],
  },
];
