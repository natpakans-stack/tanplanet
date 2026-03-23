<script setup>
import DefaultTheme from 'vitepress/theme'
import HomeSearch from './HomeSearch.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-info-after>
      <HomeSearch />
    </template>
  </Layout>
</template>
