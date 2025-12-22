<template>
  <v-card class="session-log-card" variant="tonal">
    <v-card-title class="session-log-title">
      <div class="title-text">
        <v-icon class="me-2" size="20">mdi-monitor</v-icon>
        Session Log
      </div>
      <div class="session-log-actions">
        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-content-copy"
          :disabled="!logText || copying"
          :loading="copying"
          @click="copyLog"
        >
          Copy
        </v-btn>
        <v-btn
          variant="text"
          color="primary"
          size="small"
          prepend-icon="mdi-trash-can-outline"
          :disabled="!logText"
          @click="emit('clear-log')"
        >
          Clear
        </v-btn>
      </div>
    </v-card-title>
    <v-divider></v-divider>
    <v-card-text class="log-surface" ref="logSurface">
      <pre class="log-output">{{ logText || 'Logs will appear here once actions begin.' }}</pre>
    </v-card-text>
    <v-snackbar
      v-model="copyFeedback.visible"
      :color="copyFeedback.color"
      :timeout="2000"
      location="bottom right"
    >
      {{ copyFeedback.message }}
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { SessionLogCopyFeedback, SessionLogTabEmits, SessionLogTabProps } from '../types/session-log';

const props = withDefaults(defineProps<SessionLogTabProps>(), {
  logText: '',
});

const emit = defineEmits<SessionLogTabEmits>();

const logSurface = ref<HTMLElement | null>(null);
const copying = ref(false);
const copyFeedback = ref<SessionLogCopyFeedback>({
  visible: false,
  message: '',
  color: 'success',
});

function scrollToBottom() {
  void nextTick(() => {
    const el = logSurface.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
}

watch(
  () => props.logText,
  () => {
    scrollToBottom();
  }
);

async function copyLog(): Promise<void> {
  const text = props.logText;
  if (!text || copying.value) {
    return;
  }

  try {
    copying.value = true;
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } else {
      throw new Error('Clipboard unavailable');
    }
    copyFeedback.value = {
      visible: true,
      message: 'Session log copied to clipboard.',
      color: 'success',
    };
  } catch (error: unknown) {
    console.error('Failed to copy log', error);
    copyFeedback.value = {
      visible: true,
      message: 'Unable to copy log. Please try again.',
      color: 'error',
    };
  } finally {
    copying.value = false;
  }
}

defineExpose({
  scrollToBottom,
});
</script>

<style scoped>
.session-log-card {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--v-theme-primary) 18%, transparent);
  background: color-mix(in srgb, var(--v-theme-surface) 92%, transparent);
}

.session-log-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  gap: 16px;
}

.title-text {
  display: inline-flex;
  align-items: center;
  font-size: 0.95rem;
}

.session-log-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.log-surface {
  background: rgba(15, 23, 42, 0.75);
  border-radius: 12px;
  padding: 14px;
  max-height: 100%;
  overflow-y: auto;
}

.log-output {
  margin: 0;
  font-family: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.45;
  white-space: pre-wrap;
  color: rgba(226, 232, 240, 0.9);
}
</style>
