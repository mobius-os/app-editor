export const FS_ROOT = '/api/fs'
export const START_PATH = 'apps'
export const DIRECTORY_PAGE_LIMIT = 40
export const DIRECTORY_ENTRY_LIMIT = 6000
export const DESKTOP_BREAKPOINT = 760

export const LOCATIONS = [
  { label: 'Apps', path: 'apps', icon: 'apps' },
  { label: 'Shared', path: 'shared', icon: 'folder' },
  { label: 'Platform', path: 'platform', icon: 'code' },
]

export const IMAGE_EXTENSIONS = new Set([
  'avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp',
])
export const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'opus', 'wav'])
export const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'ogv', 'webm'])
export const CODE_EXTENSIONS = new Set([
  'c', 'cc', 'cpp', 'css', 'go', 'h', 'html', 'java', 'js', 'jsx', 'json',
  'kt', 'lua', 'mjs', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'svelte',
  'swift', 'toml', 'ts', 'tsx', 'vue', 'xml', 'yaml', 'yml',
])
export const TEXT_EXTENSIONS = new Set([
  'csv', 'env', 'ini', 'log', 'markdown', 'md', 'rst', 'text', 'txt',
])
