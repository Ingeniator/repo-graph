# repo-graph

Conversation log

## User
agree. can you create git repo and put that conversation in readme file

## Assistant
Sure — I can create the local git repo, but I need one detail first:

which conversation do you want in `README.md`?
- this current chat
- some exported chat/log file
- a pasted conversation text

If you want, send:
1. repo name
2. conversation text or file
3. optional folder path

Then I’ll set it up.

## User
repo-graph

## User
2. ARG substitution

Example:
ARG BASE=node:20-alpine
FROM ${BASE}
Need at least simple default resolution.

3. Multi-stage builds

FROM builder is not an image dependency. Don’t treat it as one.

4. Monorepos

A repo may contain many Dockerfiles for many services.
Your graph should support:

• repo-level view
• dockerfile/service-level view

5. False confidence

Tool should mark uncertain mappings:

• inferred
• configured
• unresolved

That will make it trustworthy.

───

14. Recommended UX

Command examples
repo-graph scan repos.yaml --out ./output
repo-graph report ./output/graph.json
repo-graph render ./output/graph.json --format mermaid > dependency-graph.mmd
repo-graph render ./output/graph.json --format dot > dependency-graph.dot
Helpful flags

• --focus baseimages
• --depth 2
• --include-external
• --exclude-external
• --view repo|dockerfile|image
• --cached / --refresh

───

15. Example output views

A. “Who depends on baseimages?”
baseimages
├── service-a
├── service-b
└── service-c
B. “What does service-a depend on?”
service-a
└── ghcr.io/ingeniator/base-node:18
└── node:20-alpine
C. “Unresolved”
Unresolved image ownership:
- mycorp/internal-tools:latest
- ${BASE_IMAGE}
───

16. Minimal implementation order

If I were building this, I’d do exactly this order:

Step 1

Config loader

Step 2

Repo clone/update cache
Example cache dir:
.cache/repos/<repo-name>
Step 3

Dockerfile discovery

Step 4

Simple parser:

• ARG
• FROM
• AS

Step 5

Graph model

Step 6

JSON output

Step 7

Mermaid renderer

Step 8

Text report

Step 9

Focus/filter options

That’s enough for a useful first release.

───

17. Nice future additions

These could become very valuable:

• parse GitHub Actions to find actual built/pushed tags
• detect base image drift:
• service-a uses base-node:16
• service-b uses base-node:18
• visualize staleness:
• “service-c depends on old base”
• show build impact:
• “changing baseimages/base-node affects 7 services”
• integrate with Renovate/Dependabot data
• export to Markdown for docs

───

18. Recommendation on naming

Some decent names:

• repo-graph
• dockerlineage
• image-map
• dockertree
• baseimage-radar

I’d pick something boring and clear:
repo-graph or image-lineage.

───

19. Definition of done for V1

I’d call V1 successful if it can:

• scan 5–10 repos
• correctly detect all Dockerfiles
• resolve at least 80% of internal image links
• produce:
• JSON graph
• Mermaid diagram
• readable summary
• answer:
• “which services depend on baseimages?”

If it can do that reliably, it’s already worth using.

───

20. My concrete recommendation

Build:

• CLI
• TypeScript
• YAML config
• Mermaid output
• repo/image graph
• explicit image ownership mapping in config

That is the best tradeoff between usefulness and complexity.

If you want, next I can do one of two things:

1. design the exact file structure and interfaces
2. generate the MVP scaffold in code inside a new repo/workspace folder
