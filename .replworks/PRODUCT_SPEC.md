# ClayTube Product Specification

## 1. Purpose

ClayTube enables users to create and publish a branded video portal from one or more YouTube channels.

The product allows users to use YouTube as their content source while presenting the content through their own branded website.

ClayTube is intended to make this process possible without requiring users to edit source code.

---

## 2. Problem

Users and organizations may already have video content on YouTube but want to present that content through a separate branded video portal.

Creating and maintaining such a site can require additional website configuration, content management, and publishing work.

ClayTube provides a simple workflow for:

1. Defining YouTube channels.
2. Synchronizing their video content.
3. Generating a video website.
4. Publishing the website.

---

## 3. Product Goals

ClayTube must:

* Allow users to create a new ClayTube project.
* Allow users to specify YouTube channels as content sources.
* Retrieve the latest channel and video information.
* Generate a branded video portal from the synchronized content.
* Allow users to publish the generated site.
* Minimize the operational work required to maintain the site.
* Provide a content-focused website rather than a dashboard-style interface.
* Remain free and open source as a CLI product.

---

## 4. Users

ClayTube is intended for users who want to create a separate video portal from YouTube content.

Explicitly discussed use cases include:

* Education content portals
* Academy / private education video sites
* Fan communities
* Corporate media hubs
* Government and institutional curation sites
* Creators who want a branded site for their YouTube content

---

## 5. Inputs

### Project Configuration

The user provides site configuration, including:

* Site title
* YouTube channel URLs

Example:

```yaml
site:
  title: My Channel Hub

channels:
  - https://youtube.com/@cable8mm
  - https://youtube.com/@mit
```

### Commands

The user interacts with ClayTube through the following commands:

* `claytube init`
* `claytube sync`
* `claytube build`
* `claytube deploy`

Supported options explicitly defined:

* `--config`
* `--dry-run`

---

## 6. Outputs

ClayTube produces a video portal containing synchronized YouTube content.

The portal includes, at minimum:

### Channel Information

* Channel title
* Channel URL
* Channel thumbnail

### Video Information

* Video title
* Associated channel
* Published date
* Video thumbnail
* Video URL

The generated site is intended to have:

* Large thumbnails
* Clean typography
* Editorial layout
* Content-focused presentation
* Minimal UI

---

## 7. Functional Requirements

### FR-01: Initialize a Project

The user must be able to create a new ClayTube project with:

```bash
claytube init my-site
```

The user may optionally initialize the project with:

```bash
claytube init my-site --git
```

---

### FR-02: Configure Channels

The user must be able to specify one or more YouTube channel URLs in the project configuration.

---

### FR-03: Synchronize YouTube Content

The user must be able to run:

```bash
claytube sync
```

The command must retrieve the latest available channel and video metadata for the configured channels.

Synchronization must update the site's channel and video content.

---

### FR-04: Preview Synchronization

The user must be able to run:

```bash
claytube sync --dry-run
```

The command must preview synchronization changes without writing those changes.

---

### FR-05: Use an Alternative Configuration

The user must be able to specify an alternative configuration file:

```bash
claytube sync --config my.yaml
```

---

### FR-06: Build the Video Portal

The user must be able to run:

```bash
claytube build
```

The command must generate the video portal from the configured and synchronized content.

---

### FR-07: Publish the Video Portal

The user must be able to run:

```bash
claytube deploy
```

The command must publish the generated site to GitHub Pages.

---

### FR-08: Update Content

When new videos are discovered during synchronization, the generated site must be able to reflect the updated content after rebuilding.

---

### FR-09: Content-Focused Presentation

The generated site must prioritize video content.

The default design must avoid:

* Dashboard-style presentation
* Clutter
* Excessive filtering

---

## 8. User Flows

### Flow 1: Create a New Site

1. User runs `claytube init my-site`.
2. ClayTube creates a new project.
3. User specifies the site title.
4. User specifies one or more YouTube channel URLs.
5. User synchronizes the configured channels.
6. User builds the site.
7. User deploys the site.

---

### Flow 2: Update an Existing Site

1. User updates the configured YouTube channels as needed.
2. User runs `claytube sync`.
3. ClayTube retrieves the latest channel and video information.
4. User runs `claytube build`.
5. The generated site reflects the synchronized content.
6. User runs `claytube deploy` to publish the updated site.

---

### Flow 3: Preview Synchronization

1. User runs `claytube sync --dry-run`.
2. ClayTube shows the synchronization changes without writing them.
3. User can then perform the actual synchronization separately.

---

### Flow 4: Use a Specific Configuration

1. User provides a configuration file.
2. User runs `claytube sync --config my.yaml`.
3. ClayTube uses the specified configuration for synchronization.

---

## 9. Error Conditions

ClayTube must report an error when:

* A configured YouTube URL is invalid.
* The required YouTube API key is missing.
* The build operation fails.

Errors must be presented to the user rather than silently ignored.

---

## 10. Non-Goals

The following are outside the defined product scope:

* Replacing YouTube as a video platform.
* Building a new video hosting platform.
* Building a general-purpose content management system.
* Providing a dashboard-style administration product.
* Adding excessive filtering to the video portal.
* Making ClayTube itself a paid software product.

---

## 11. Acceptance Criteria

ClayTube is acceptable for the defined scope when:

1. A user can create a new ClayTube project without manually editing source code.
2. A user can configure one or more YouTube channels.
3. A user can synchronize the configured channels.
4. Synchronization produces usable channel and video information.
5. A user can preview synchronization without writing changes.
6. A user can generate a video portal from the synchronized content.
7. The generated portal presents the content with the defined content-focused design principles.
8. A user can publish the generated portal to GitHub Pages.
9. A user can repeat synchronization and rebuilding to update the site's content.
10. Invalid YouTube URLs, missing API keys, and build failures produce explicit errors.

---

## 12. Success Criteria

### Primary Success Metric

* Number of active ClayTube sites.

### Secondary Success Metrics

* Number of inbound service inquiries.
* Conversion to paid setup services.
* Number of recurring managed hosting customers.

### Product Success

The product succeeds when users can take YouTube channel content and independently produce a branded video portal through the defined ClayTube workflow, without needing to modify source code.
