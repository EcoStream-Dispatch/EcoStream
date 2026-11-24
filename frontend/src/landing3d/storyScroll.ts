import { useEffect, type RefObject } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SECTIONS, story, type SectionId } from './store'

gsap.registerPlugin(ScrollTrigger)

/**
 * Smooth scrolling plus a 0..1 progress value for every `[data-story]` section (story.progress).
 * `storyEnd` marks where the story is over; `onStoryOver` is told when it scrolls past it,
 * so the page can stop drawing.
 */
export function useStoryScroll(storyEnd: RefObject<HTMLElement>, onStoryOver?: (over: boolean) => void) {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1 })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const triggers: ScrollTrigger[] = []
    document.querySelectorAll<HTMLElement>('[data-story]').forEach((el) => {
      const id = el.dataset.story as SectionId
      if (!SECTIONS.includes(id)) return
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            story.progress[id] = self.progress
          },
        }),
      )
    })
    if (storyEnd.current) {
      triggers.push(
        ScrollTrigger.create({
          trigger: storyEnd.current,
          start: 'top top',
          onToggle: (self) => {
            story.visible = !self.isActive
            onStoryOver?.(self.isActive)
          },
        }),
      )
    }
    return () => {
      triggers.forEach((tr) => tr.kill())
      gsap.ticker.remove(tick)
      lenis.destroy()
      story.visible = true
      SECTIONS.forEach((s) => (story.progress[s] = 0))
    }
  }, [storyEnd, onStoryOver])
}
