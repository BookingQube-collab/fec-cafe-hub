import { useState, useEffect } from "react";
import { OpenCafeAccount, OpenCafeMenuDesign } from '@/components/open-cafe-account';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  Building2, 
  Eye, 
  EyeOff,
  Key,
  Save,
  QrCode,
  UtensilsCrossed,
  FolderOpen,
  Plus,
  Edit,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { Restaurant, User, Category, MenuItem } from "@shared/schema";
import PermanentMenuQR from "@/components/permanent-menu-qr";

interface RestaurantWithOwner extends Restaurant {
  owner: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> | null;
}

export default function SuperAdminRestaurantDetail() {
  const { toast } = useToast();
  const [, params] = useRoute("/super-admin/restaurant/:id");
  const [, navigate] = useLocation();
  const restaurantId = params?.id;

  const { data: restaurant, isLoading } = useQuery<RestaurantWithOwner>({
    queryKey: [`/api/super-admin/restaurants/${restaurantId}`],
    enabled: !!restaurantId,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: [`/api/super-admin/categories/${restaurantId}`],
    enabled: !!restaurantId,
  });

  const { data: menuItems } = useQuery<MenuItem[]>({
    queryKey: [`/api/super-admin/menu-items/${restaurantId}`],
    enabled: !!restaurantId,
  });

  const [profileData, setProfileData] = useState({
    name: "",
    cuisineType: "",
    address: "",
    phone: "",
    openingHours: "",
  });

  const [isHidden, setIsHidden] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [coverMediaUrl, setCoverMediaUrl] = useState("");
  const [coverMediaType, setCoverMediaType] = useState<"image" | "video" | "gif" | null>(null);

  // Category management state
  const [categoryDialog, setCategoryDialog] = useState<{open: boolean; category?: Category}>({open: false});
  const [categoryFormData, setCategoryFormData] = useState({ title: "", order: 0 });
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Menu item management state
  const [menuItemDialog, setMenuItemDialog] = useState<{open: boolean; item?: MenuItem}>({open: false});
  const [menuItemFormData, setMenuItemFormData] = useState({
    name: "",
    description: "",
    price: "",
    discount: "0",
    categoryId: "",
    isAvailable: true,
  });
  const [deleteMenuItemId, setDeleteMenuItemId] = useState<string | null>(null);

  // Load restaurant data when available
  useEffect(() => {
    if (restaurant) {
      setProfileData({
        name: restaurant.name || "",
        cuisineType: restaurant.cuisineType || "",
        address: restaurant.address || "",
        phone: restaurant.phone || "",
        openingHours: restaurant.openingHours || "",
      });
      setIsHidden(!!restaurant.hidden);
      setCoverMediaUrl(restaurant.coverMediaUrl || "");
      setCoverMediaType(restaurant.coverMediaType as "image" | "video" | "gif" | null);
    }
  }, [restaurant]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      // Validate required fields
      if (!profileData.name || profileData.name.trim() === "") {
        throw new Error("Restaurant name is required");
      }
      await apiRequest("PUT", `/api/super-admin/restaurants/${restaurantId}/profile`, profileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/restaurants/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/restaurants"] });
      toast({
        title: "Profile Updated",
        description: "Restaurant profile has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update restaurant profile",
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (hidden: boolean) => {
      await apiRequest("PUT", `/api/super-admin/restaurants/${restaurantId}/visibility`, { hidden });
    },
    onSuccess: (_, hidden) => {
      setIsHidden(hidden);
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/restaurants/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/restaurants"] });
      toast({
        title: "Visibility Updated",
        description: "Restaurant visibility has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update visibility",
        variant: "destructive",
      });
    },
  });

  // Cover media upload handlers
  const handleCoverMediaUpload = async () => {
    const response = await apiRequest('POST', `/api/super-admin/restaurants/${restaurantId}/upload`);
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleCoverMediaComplete = async (result: { successful: { uploadURL: string; type: string }[] }) => {
    const file = result.successful[0];
    if (!file?.uploadURL) throw new Error('Upload did not return a file');
    const mediaType = file.type === 'image/gif' ? 'gif' : file.type === 'video/mp4' ? 'video' : 'image';
    const response = await apiRequest('PUT', `/api/super-admin/restaurants/${restaurantId}/cover-media`, { coverMediaUrl: file.uploadURL, coverMediaType: mediaType });
    const data = await response.json();
    setCoverMediaUrl(data.objectPath);
    setCoverMediaType(mediaType);
    await queryClient.invalidateQueries({ queryKey: [`/api/super-admin/restaurants/${restaurantId}`] });
    await queryClient.invalidateQueries({ queryKey: ['/api/manager-menu'] });
  };

  const handleRemoveCoverMedia = async () => {
    try {
      await apiRequest("PUT", `/api/super-admin/restaurants/${restaurantId}/cover-media`, {
        coverMediaUrl: "",
        coverMediaType: "image",
      });
      setCoverMediaUrl("");
      setCoverMediaType(null);
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/restaurants/${restaurantId}`] });
      toast({
        title: "Success",
        description: "Cover media removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove cover media",
        variant: "destructive",
      });
    }
  };

  const updatePasswordMutation = useMutation({
    mutationFn: async () => {
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      await apiRequest("PUT", `/api/super-admin/restaurants/${restaurantId}/password`, {
        newPassword: passwordData.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "Restaurant owner password has been reset successfully",
      });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!categoryFormData.title.trim()) throw new Error("Category title is required");
      await apiRequest("POST", `/api/super-admin/restaurants/${restaurantId}/categories`, categoryFormData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/categories/${restaurantId}`] });
      setCategoryDialog({open: false});
      setCategoryFormData({ title: "", order: 0 });
      toast({ title: "Success", description: "Category created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create category", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!categoryFormData.title.trim()) throw new Error("Category title is required");
      if (!categoryDialog.category?.id) throw new Error("Category ID is required");
      await apiRequest("PUT", `/api/super-admin/categories/${categoryDialog.category.id}`, categoryFormData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/categories/${restaurantId}`] });
      setCategoryDialog({open: false});
      toast({ title: "Success", description: "Category updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await apiRequest("DELETE", `/api/super-admin/categories/${categoryId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/categories/${restaurantId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/menu-items/${restaurantId}`] });
      setDeleteCategoryId(null);
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    },
  });

  // Menu item mutations
  const createMenuItemMutation = useMutation({
    mutationFn: async () => {
      if (!menuItemFormData.name.trim()) throw new Error("Menu item name is required");
      if (!menuItemFormData.price || parseFloat(menuItemFormData.price) <= 0) throw new Error("Valid price is required");
      await apiRequest("POST", `/api/super-admin/restaurants/${restaurantId}/menu-items`, {
        ...menuItemFormData,
        price: parseFloat(menuItemFormData.price),
        discount: parseFloat(menuItemFormData.discount) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/menu-items/${restaurantId}`] });
      setMenuItemDialog({open: false});
      setMenuItemFormData({ name: "", description: "", price: "", discount: "0", categoryId: "", isAvailable: true });
      toast({ title: "Success", description: "Menu item created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create menu item", variant: "destructive" });
    },
  });

  const updateMenuItemMutation = useMutation({
    mutationFn: async () => {
      if (!menuItemFormData.name.trim()) throw new Error("Menu item name is required");
      if (!menuItemFormData.price || parseFloat(menuItemFormData.price) <= 0) throw new Error("Valid price is required");
      if (!menuItemDialog.item?.id) throw new Error("Menu item ID is required");
      await apiRequest("PUT", `/api/super-admin/menu-items/${menuItemDialog.item.id}`, {
        ...menuItemFormData,
        price: parseFloat(menuItemFormData.price),
        discount: parseFloat(menuItemFormData.discount) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/menu-items/${restaurantId}`] });
      setMenuItemDialog({open: false});
      setMenuItemFormData({ name: "", description: "", price: "", discount: "0", categoryId: "", isAvailable: true });
      toast({ title: "Success", description: "Menu item updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update menu item", variant: "destructive" });
    },
  });

  const deleteMenuItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/super-admin/menu-items/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/super-admin/menu-items/${restaurantId}`] });
      setDeleteMenuItemId(null);
      toast({ title: "Success", description: "Menu item deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete menu item", variant: "destructive" });
    },
  });

  // Handlers for opening dialogs
  const handleAddCategory = () => {
    setCategoryFormData({ title: "", order: (categories?.length || 0) + 1 });
    setCategoryDialog({ open: true });
  };

  const handleEditCategory = (category: Category) => {
    setCategoryFormData({ title: category.title, order: category.order });
    setCategoryDialog({ open: true, category });
  };

  const handleAddMenuItem = () => {
    setMenuItemFormData({ name: "", description: "", price: "", discount: "0", categoryId: categories?.[0]?.id || "", isAvailable: true });
    setMenuItemDialog({ open: true });
  };

  const handleEditMenuItem = (item: MenuItem) => {
    setMenuItemFormData({
      name: item.name,
      description: item.description || "",
      price: item.price.toString(),
      discount: item.discount?.toString() || "0",
      categoryId: item.categoryId || "",
      isAvailable: item.isAvailable,
    });
    setMenuItemDialog({ open: true, item });
  };

  if (isLoading || !restaurant) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading restaurant...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/super-admin")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="heading-restaurant-name">
            <Building2 className="h-8 w-8" />
            {restaurant.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage restaurant profile, menu, and access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OpenCafeAccount id={restaurant.id} name={restaurant.name}/>
          <OpenCafeMenuDesign id={restaurant.id} name={restaurant.name}/>
          {restaurant.status === "suspended" ? (
            <Badge variant="destructive">Suspended</Badge>
          ) : (
            <Badge variant="default">Active</Badge>
          )}
          {isHidden ? (
            <Badge variant="secondary"><EyeOff className="h-3 w-3 mr-1" />Hidden</Badge>
          ) : (
            <Badge variant="outline"><Eye className="h-3 w-3 mr-1" />Visible</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" data-testid="tab-profile">
            <Building2 className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="menu" data-testid="tab-menu">
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Menu & Categories
          </TabsTrigger>
          <TabsTrigger value="qr" data-testid="tab-qr">
            <QrCode className="h-4 w-4 mr-2" />
            Menu QR
          </TabsTrigger>
          <TabsTrigger value="access" data-testid="tab-access">
            <Key className="h-4 w-4 mr-2" />
            Access & Password
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Profile</CardTitle>
              <CardDescription>Edit restaurant information and visibility settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Restaurant Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    data-testid="input-restaurant-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuisineType">Cuisine Type</Label>
                  <Input
                    id="cuisineType"
                    value={profileData.cuisineType}
                    onChange={(e) => setProfileData({ ...profileData, cuisineType: e.target.value })}
                    placeholder="e.g., Italian, Chinese, Indian"
                    data-testid="input-cuisine-type"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  rows={2}
                  data-testid="input-address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="+91 1234567890"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="openingHours">Opening Hours</Label>
                  <Input
                    id="openingHours"
                    value={profileData.openingHours}
                    onChange={(e) => setProfileData({ ...profileData, openingHours: e.target.value })}
                    placeholder="e.g., Mon-Fri 9AM-10PM"
                    data-testid="input-opening-hours"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="visibility">Restaurant Visibility</Label>
                  <p className="text-sm text-muted-foreground">
                    Hide this restaurant from public view
                  </p>
                </div>
                <Switch
                  id="visibility"
                  checked={isHidden}
                  onCheckedChange={(checked) => toggleVisibilityMutation.mutate(checked)}
                  disabled={toggleVisibilityMutation.isPending}
                  data-testid="switch-visibility"
                />
              </div>

              <Button 
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending || isLoading || !profileData.name}
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Menu Cover Media</CardTitle>
              <CardDescription>Add a cover video, GIF, or image for the menu (Max 5MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {coverMediaUrl ? (
                <div className="relative rounded-lg overflow-hidden border">
                  {coverMediaType === "video" ? (
                    <video
                      src={`/api/objects/${coverMediaUrl}`}
                      className="w-full h-64 object-cover"
                      controls
                      autoPlay
                      muted
                      loop
                    />
                  ) : (
                    <img
                      src={`/api/objects/${coverMediaUrl}`}
                      alt="Cover media"
                      className="w-full h-64 object-cover"
                    />
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveCoverMedia}
                    data-testid="button-remove-cover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a video, GIF, or image to enhance your menu display
                  </p>
                  <ObjectUploader
                    maxFileSize={5242880}
                    accept="image/png,image/jpeg,image/gif,image/webp,video/mp4"
                    onGetUploadParameters={handleCoverMediaUpload}
                    onComplete={handleCoverMediaComplete}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Cover Media
                  </ObjectUploader>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Supported formats: Images (JPG, PNG, GIF, WebP), Videos (MP4). Maximum file size: 5MB
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Categories</CardTitle>
                  <CardDescription>Organize menu items into categories</CardDescription>
                </div>
                <Button onClick={handleAddCategory} data-testid="button-add-category">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categories && categories.length > 0 ? (
                  categories.map((category) => (
                    <Card key={category.id} className="hover-elevate">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FolderOpen className="h-4 w-4 text-primary" />
                          <span className="font-medium" data-testid={`text-category-${category.id}`}>{category.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEditCategory(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteCategoryId(category.id)}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No categories yet. Add your first category to start organizing your menu.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Menu Items</CardTitle>
                  <CardDescription>Manage all menu items for this restaurant</CardDescription>
                </div>
                <Button onClick={handleAddMenuItem} disabled={!categories || categories.length === 0} data-testid="button-add-menu-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Menu Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {menuItems && menuItems.length > 0 ? (
                  menuItems.map((item) => (
                    <Card key={item.id} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <UtensilsCrossed className="h-4 w-4 text-primary" />
                            <div className="flex-1">
                              <p className="font-medium" data-testid={`text-item-name-${item.id}`}>{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm font-medium">₹{item.price}</p>
                                <Badge variant={item.isAvailable ? "default" : "secondary"} className="text-xs">
                                  {item.isAvailable ? "Available" : "Unavailable"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEditMenuItem(item)}
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeleteMenuItemId(item.id)}
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {categories && categories.length > 0
                      ? "No menu items yet. Add your first menu item to get started."
                      : "Create at least one category before adding menu items."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4"><PermanentMenuQR key={restaurant.id} restaurant={restaurant}/></TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access & Password</CardTitle>
              <CardDescription>Manage restaurant owner access and reset password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Owner Information</p>
                <div className="space-y-1">
                  <p className="text-sm">Email: {restaurant.owner?.email || "No owner assigned"}</p>
                  {restaurant.owner?.firstName && (
                    <p className="text-sm">Name: {restaurant.owner.firstName} {restaurant.owner.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">Reset Password</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      minLength={10}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="At least 10 characters"
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <Button 
                    onClick={() => updatePasswordMutation.mutate()}
                    disabled={updatePasswordMutation.isPending || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                    variant="destructive"
                    data-testid="button-reset-password"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    {updatePasswordMutation.isPending ? "Updating..." : "Reset Password"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onOpenChange={(open) => setCategoryDialog({open})}>
        <DialogContent data-testid="dialog-category">
          <DialogHeader>
            <DialogTitle>{categoryDialog.category ? "Edit Category" : "Add Category"}</DialogTitle>
            <DialogDescription>
              {categoryDialog.category ? "Update category details" : "Create a new category for organizing menu items"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryTitle">Category Title</Label>
              <Input
                id="categoryTitle"
                value={categoryFormData.title}
                onChange={(e) => setCategoryFormData({...categoryFormData, title: e.target.value})}
                placeholder="e.g. Appetizers, Main Course, Desserts"
                data-testid="input-category-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryOrder">Display Order</Label>
              <Input
                id="categoryOrder"
                type="number"
                value={categoryFormData.order}
                onChange={(e) => setCategoryFormData({...categoryFormData, order: parseInt(e.target.value) || 0})}
                data-testid="input-category-order"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog({open: false})} data-testid="button-cancel-category">
              Cancel
            </Button>
            <Button 
              onClick={() => categoryDialog.category ? updateCategoryMutation.mutate() : createCategoryMutation.mutate()}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending || !categoryFormData.title}
              data-testid="button-save-category"
            >
              {createCategoryMutation.isPending || updateCategoryMutation.isPending ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={menuItemDialog.open} onOpenChange={(open) => setMenuItemDialog({open})}>
        <DialogContent data-testid="dialog-menu-item">
          <DialogHeader>
            <DialogTitle>{menuItemDialog.item ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
            <DialogDescription>
              {menuItemDialog.item ? "Update menu item details" : "Create a new menu item"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                value={menuItemFormData.name}
                onChange={(e) => setMenuItemFormData({...menuItemFormData, name: e.target.value})}
                placeholder="e.g. Margherita Pizza"
                data-testid="input-item-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemDescription">Description (Optional)</Label>
              <Textarea
                id="itemDescription"
                value={menuItemFormData.description}
                onChange={(e) => setMenuItemFormData({...menuItemFormData, description: e.target.value})}
                placeholder="Describe the dish..."
                data-testid="input-item-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemPrice">Price (₹)</Label>
              <Input
                id="itemPrice"
                type="number"
                step="0.01"
                value={menuItemFormData.price}
                onChange={(e) => setMenuItemFormData({...menuItemFormData, price: e.target.value})}
                placeholder="0.00"
                data-testid="input-item-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemDiscount">Discount (%) - Optional</Label>
              <Input
                id="itemDiscount"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={menuItemFormData.discount}
                onChange={(e) => setMenuItemFormData({...menuItemFormData, discount: e.target.value})}
                placeholder="0"
                data-testid="input-item-discount"
              />
              <p className="text-xs text-muted-foreground">Leave at 0 if no discount</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemCategory">Category</Label>
              <Select 
                value={menuItemFormData.categoryId} 
                onValueChange={(value) => setMenuItemFormData({...menuItemFormData, categoryId: value})}
              >
                <SelectTrigger id="itemCategory" data-testid="select-item-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories && categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="itemAvailable"
                checked={menuItemFormData.isAvailable}
                onCheckedChange={(checked) => setMenuItemFormData({...menuItemFormData, isAvailable: checked})}
                data-testid="switch-item-available"
              />
              <Label htmlFor="itemAvailable">Available for customers</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMenuItemDialog({open: false})} data-testid="button-cancel-menu-item">
              Cancel
            </Button>
            <Button 
              onClick={() => menuItemDialog.item ? updateMenuItemMutation.mutate() : createMenuItemMutation.mutate()}
              disabled={createMenuItemMutation.isPending || updateMenuItemMutation.isPending || !menuItemFormData.name || !menuItemFormData.price}
              data-testid="button-save-menu-item"
            >
              {createMenuItemMutation.isPending || updateMenuItemMutation.isPending ? "Saving..." : "Save Menu Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent data-testid="dialog-delete-category">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this category and all associated menu items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteCategoryId && deleteCategoryMutation.mutate(deleteCategoryId)}
              disabled={deleteCategoryMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-category"
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Menu Item Confirmation */}
      <AlertDialog open={!!deleteMenuItemId} onOpenChange={(open) => !open && setDeleteMenuItemId(null)}>
        <AlertDialogContent data-testid="dialog-delete-menu-item">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this menu item. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-item">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMenuItemId && deleteMenuItemMutation.mutate(deleteMenuItemId)}
              disabled={deleteMenuItemMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-item"
            >
              {deleteMenuItemMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
