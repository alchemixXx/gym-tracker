import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

interface User {
  id: number
  name: string
  created_at: string
}

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null)
  const users = ref<User[]>([])

  // Restore from localStorage
  const saved = localStorage.getItem('gym-tracker-user')
  if (saved) {
    try {
      currentUser.value = JSON.parse(saved)
    } catch {}
  }

  async function fetchUsers() {
    users.value = await api.getUsers()
  }

  async function createUser(name: string) {
    const user = await api.createUser(name)
    users.value.push(user)
    return user
  }

  function selectUser(user: User) {
    currentUser.value = user
    localStorage.setItem('gym-tracker-user', JSON.stringify(user))
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('gym-tracker-user')
  }

  return { currentUser, users, fetchUsers, createUser, selectUser, logout }
})
