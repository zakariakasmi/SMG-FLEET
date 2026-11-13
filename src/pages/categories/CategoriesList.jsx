import { useState, useEffect } from 'react'
import { Plus, Edit01 as Edit, Trash01 as Trash2, Tag01 as Tag } from '@untitledui/icons'
import { useTranslation } from 'react-i18next'
import { categoriesApi } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { PageSpinner } from '../../components/ui/Spinner'
import { ConfirmModal } from '../../components/ui/Modal'

export default function CategoriesList() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [currentCategory, setCurrentCategory] = useState(null)
  const [categoryToDelete, setCategoryToDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { showToast } = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const data = await categoriesApi.list()
      setCategories(data || [])
    } catch (error) {
      showToast(t('categories.failedToLoad'), 'error')
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (category) => {
    setCurrentCategory(category)
    setFormData({
      name: category?.name || '',
      description: category?.description || '',
    })
    setEditModal(true)
  }

  const closeEditModal = () => {
    setEditModal(false)
    setCurrentCategory(null)
    setFormData({ name: '', description: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showToast(t('categories.nameRequired'), 'error')
      return
    }

    try {
      setSaving(true)
      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      }

      if (currentCategory) {
        await categoriesApi.update(currentCategory.id, categoryData)
        showToast(t('categories.categoryUpdated'), 'success')
      } else {
        await categoriesApi.create(categoryData)
        showToast(t('categories.categoryCreated'), 'success')
      }

      loadCategories()
      closeEditModal()
    } catch (error) {
      showToast(error.message || t('categories.failedToSave'), 'error')
      console.error('Error saving category:', error)
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (category) => {
    setCurrentCategory(category)
    setCategoryToDelete(category)
    setDeleteModal(true)
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await categoriesApi.delete(currentCategory.id)
      showToast('Category deleted successfully', 'success')
      loadCategories()
    } catch (error) {
      showToast(t('categories.failedToDelete'), 'error')
      console.error('Error deleting category:', error)
    } finally {
      setDeleting(false)
      setDeleteModal(false)
      setCurrentCategory(null)
      setCategoryToDelete(null)
    }
  }

  if (loading) {
    return <PageSpinner message={t('categories.loadingCategories')} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('categories.title')}</h1>
          <p className="text-sm mt-1 text-muted-foreground">
            {t('categories.subtitle')}
          </p>
        </div>

        <Button onClick={() => openEditModal(null)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('categories.addCategory')}
        </Button>
      </div>

      {/* Stats */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl text-primary">
              {categories.length}
            </div>
            <div className="text-sm text-muted-foreground">{t('categories.totalCategories')}</div>
          </div>

          <div className="text-center">
            <div className="text-3xl text-success">
              {categories.filter(c => c.description).length}
            </div>
            <div className="text-sm text-muted-foreground">{t('categories.withDescription')}</div>
          </div>

          <div className="text-center">
            <div className="text-3xl text-fuchsia-600 dark:text-fuchsia-400">
              {categories.filter(c => !c.description).length}
            </div>
            <div className="text-sm text-muted-foreground">{t('categories.withoutDescription')}</div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      {categories.length === 0 ? (
        <div className="text-center py-12">
          <Tag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg mb-2 text-foreground">{t('categories.noCategories')}</h3>
          <p className="text-sm mb-4 text-muted-foreground">{t('categories.noCategoriesDesc')}</p>
          <Button onClick={() => openEditModal(null)}>
            {t('categories.addFirstCategory')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-card border border-border rounded-lg shadow-sm p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-medium text-foreground">{category.name}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-1 text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(category)}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm mb-4 text-muted-foreground">
                {category.description || t('categories.noDescription')}
              </p>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('categories.created')} {new Date(category.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={editModal}
        onClose={closeEditModal}
        title={currentCategory ? t('categories.editCategory') : t('categories.addCategory')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeEditModal} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {currentCategory ? t('common.update') : t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('categories.categoryName')}
            placeholder={t('categories.nameExample')}
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm mb-1 text-muted-foreground">
              {t('categories.description')}
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-md shadow-sm bg-input border border-input text-foreground focus:outline-none"
              placeholder={t('categories.optionalDescription')}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title={t('categories.deleteCategory')}
        message={t('categories.deleteConfirm', { name: categoryToDelete?.name })}
        confirmText="Delete"
        loading={deleting}
      />
    </div>
  )
}
