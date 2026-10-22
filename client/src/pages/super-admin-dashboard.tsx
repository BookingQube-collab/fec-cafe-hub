import { useState } from "react";
import { Link } from 'wouter';
import { OpenCafeAccount } from '@/components/open-cafe-account';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, 
  Ban, 
  CheckCircle, 
  Settings, QrCode, Eye, EyeOff, Plus
} from "lucide-react";
import type { Restaurant } from "@shared/schema";
import PermanentMenuQR from "@/components/permanent-menu-qr";

interface RestaurantWithOwner extends Restaurant {
  owner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

function SuspendRestaurantDialog({ 
  restaurant, 
  open, 
  onOpenChange 
}: { 
  restaurant: RestaurantWithOwner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const suspendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/super-admin/restaurants/${restaurant.id}/suspend`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/restaurants"] });
      toast({
        title: "Restaurant Suspended",
        description: "Restaurant has been suspended successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to suspend restaurant",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend Restaurant</DialogTitle>
          <DialogDescription>
            Suspend {restaurant.name}. The restaurant will be hidden from public view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Suspension Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Temporarily closed for renovations..."
              rows={3}
              required
              data-testid="input-suspension-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-suspend">
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={() => suspendMutation.mutate()} 
            disabled={suspendMutation.isPending || !reason}
            data-testid="button-confirm-suspend"
          >
            {suspendMutation.isPending ? "Suspending..." : "Suspend Restaurant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAdminDashboard() {
  const { toast } = useToast();
  const [qrRestaurant, setQrRestaurant] = useState<RestaurantWithOwner | null>(null);
  const [suspendRestaurant, setSuspendRestaurant] = useState<RestaurantWithOwner | null>(null);

  const { data: restaurants, isLoading } = useQuery<RestaurantWithOwner[]>({
    queryKey: ["/api/super-admin/restaurants"],
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/super-admin/restaurants/${id}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/restaurants"] });
      toast({
        title: "Restaurant Activated",
        description: "Restaurant has been activated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to activate restaurant",
        variant: "destructive",
      });
    },
  });

  const stats = [
    { label:'Total cafés', count:restaurants?.length || 0, icon:Building2 },
    { label:'Live customer menus', count:restaurants?.filter(r=>r.status==='active' && !r.hidden).length || 0, icon:Eye },
    { label:'Paused cafés', count:restaurants?.filter(r=>r.status!=='active').length || 0, icon:Ban },
    { label:'Hidden menus', count:restaurants?.filter(r=>r.hidden).length || 0, icon:EyeOff },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading restaurants...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="staff-platform-heading">
        <div><p className="manager-eyebrow">YOUR WORKSPACE, AT A GLANCE</p>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-super-admin">
          Your cafés, beautifully managed.
        </h1>
        <p className="text-muted-foreground mt-1">
          Every restaurant, menu and team. One connected workspace.
        </p>
        </div><Button asChild><Link href="/super-admin/restaurants/new"><Plus/>Add café</Link></Button>
      </div>

      <div className="manager-stats">{stats.map(stat=><div className="manager-stat" key={stat.label}><stat.icon/><strong>{stat.count}</strong><span>{stat.label}</span></div>)}</div>

      <div className="staff-platform-grid">
        {restaurants && restaurants.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No restaurants registered yet</p>
            </CardContent>
          </Card>
        )}

        {restaurants && restaurants.map((restaurant) => (
          <Card key={restaurant.id} className="staff-restaurant-card" data-testid={`card-restaurant-${restaurant.id}`}>
            <CardHeader>
              <div className="staff-restaurant-avatar">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`}/> : <Building2 size={23}/>}</div>
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{restaurant.name}</CardTitle>
                    {restaurant.status === "suspended" ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                    {restaurant.owner && (
                      <span data-restaurant-owner>{restaurant.owner.email}</span>
                    )}
                    {restaurant.phone && <span>📞 {restaurant.phone}</span>}
                    {restaurant.cuisineType && <span>🍽️ {restaurant.cuisineType}</span>}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="staff-restaurant-meta grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div><p className="text-xs text-muted-foreground">Customer menu</p><p className="text-sm font-medium">{restaurant.status === 'active' && !restaurant.hidden ? 'Visible to guests' : 'Currently unavailable to guests'}</p></div>
                <div><p className="text-xs text-muted-foreground">Menu identity</p><p className="text-sm font-medium">One permanent restaurant QR</p></div>
              </div>

              {restaurant.suspensionReason && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">
                    <strong>Suspension Reason:</strong> {restaurant.suspensionReason}
                  </p>
                </div>
              )}

              <div className="staff-restaurant-actions flex flex-wrap gap-2 pt-2">
                <OpenCafeAccount id={restaurant.id} name={restaurant.name}/>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = `/super-admin/restaurant/${restaurant.id}`}
                  data-testid={`button-manage-${restaurant.id}`}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Platform controls
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQrRestaurant(restaurant)} data-testid={`button-menu-qr-${restaurant.id}`}><QrCode className="h-4 w-4 mr-1"/>Menu QR</Button>
                {restaurant.status === "suspended" ? (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => activateMutation.mutate(restaurant.id)}
                    disabled={activateMutation.isPending}
                    data-testid={`button-activate-${restaurant.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setSuspendRestaurant(restaurant)}
                    data-testid={`button-suspend-${restaurant.id}`}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Suspend
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {qrRestaurant && <Dialog open onOpenChange={open => !open && setQrRestaurant(null)}><DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{qrRestaurant.name} menu QR</DialogTitle><DialogDescription>One permanent menu link for this restaurant.</DialogDescription></DialogHeader><PermanentMenuQR key={qrRestaurant.id} restaurant={qrRestaurant}/></DialogContent></Dialog>}

      {suspendRestaurant && (
        <SuspendRestaurantDialog
          restaurant={suspendRestaurant}
          open={!!suspendRestaurant}
          onOpenChange={(open) => !open && setSuspendRestaurant(null)}
        />
      )}
    </div>
  );
}
