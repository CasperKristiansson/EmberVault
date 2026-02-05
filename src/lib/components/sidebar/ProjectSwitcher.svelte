<script lang="ts">
  import type { Project } from "$lib/core/storage/types";
  import { sortProjectsByUpdatedAt } from "$lib/core/utils/projects";

  export let projects: Project[] = [];
  export let activeProjectId = "";
  export let onSelect: (projectId: string) => void = () => {};

  $: displayProjects = sortProjectsByUpdatedAt(projects);
  $: isDisabled = displayProjects.length <= 1;

  const handleChange = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    if (!target.value || target.value === activeProjectId) {
      return;
    }
    onSelect(target.value);
  };
</script>

<div class="project-switcher" data-testid="project-switcher">
  <select
    class="project-select"
    aria-label="Project switcher"
    value={activeProjectId}
    on:change={handleChange}
    disabled={isDisabled}
  >
    {#if displayProjects.length === 0}
      <option value="" disabled>Loading projects...</option>
    {:else}
      {#each displayProjects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    {/if}
  </select>
</div>

<style>
  .project-switcher {
    display: flex;
    align-items: center;
    height: 44px;
  }

  .project-select {
    width: 100%;
    height: 32px;
    padding: 0 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-0);
    font-weight: 500;
  }

  .project-select:focus-visible {
    border-color: rgba(255, 138, 42, 0.4);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .project-select:disabled {
    color: var(--text-2);
    cursor: not-allowed;
  }
</style>
