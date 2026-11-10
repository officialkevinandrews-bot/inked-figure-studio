# Inked Figure Studio

I would like to create my own app which has all of the features of ComiPo, a manga creation studio. One of its best features is the ability to bring 3D models in and use them. I will bring pre-rigged (Mixamo) models (.glb/.fbx) and want to be able to pose them with a massive library of true preset poses (fighting poses, walking poses, sitting, dramatic manga poses, hand gestures) that work reliably on a Mixamo rigged humanoid 3D model.

Please build Phase 1 first, focusing on:
1. A 3D manga viewport with cel-shading (ink outlines and manga-style shading).
2. Mixamo model drag-and-drop loader supporting standard Mixamo humanoid rigs with bone mapping.
3. Interactive pose system: comprehensive categorized library of preset manga and action poses with 1-click apply, pose fine-tuning controls (joint rotation gizmos), and pose mirroring.
4. Clean manga studio interface prepared for page layouts and panels in later phases.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://inked-figure-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb4a42a0-c147-4753-87fc-219574adfc63).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
