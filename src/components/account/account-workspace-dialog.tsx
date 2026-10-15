"use client";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { AccountProfileForm } from "./account-profile-form";
import { WorkspaceMembers } from "./workspace-members";
export function AccountWorkspaceDialog({
  onClose,
  opener,
}: {
  onClose: () => void;
  opener: HTMLElement | null;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  const mobile = useIsMobile();
  const [tab, setTab] = useState("account");
  const restoreFocus = (event: Event) => {
    if (opener?.isConnected) {
      event.preventDefault();
      opener.focus();
    }
  };
  const content = (
    <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-4">
      <TabsList className="mx-4 h-10 shrink-0 sm:mx-6 sm:h-8">
        <TabsTrigger value="account" className="px-4">
          Account
        </TabsTrigger>
        <TabsTrigger value="workspace" className="px-4">
          Workspace
        </TabsTrigger>
      </TabsList>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6">
        <TabsContent value="account">
          <AccountProfileForm />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceMembers />
        </TabsContent>
      </div>
    </Tabs>
  );
  if (mobile)
    return (
      <Drawer
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DrawerContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            title.current?.focus();
          }}
          onCloseAutoFocus={restoreFocus}
          className="max-h-[90dvh] data-[vaul-drawer-direction=bottom]:max-h-[90dvh] [&_button]:min-h-10 [&_input]:h-10"
        >
          <DrawerHeader className="shrink-0 text-left">
            <DrawerTitle ref={title} tabIndex={-1}>
              Account & workspace
            </DrawerTitle>
            <DrawerDescription>
              Manage your details and workspace access.
            </DrawerDescription>
          </DrawerHeader>
          {content}
          <Button
            className="mx-4 mb-4 shrink-0"
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[85dvh] flex-col gap-5 overflow-hidden px-0 pb-0 sm:max-w-lg"
        onCloseAutoFocus={restoreFocus}
      >
        <DialogHeader className="shrink-0 px-6 pr-10">
          <DialogTitle>Account & workspace</DialogTitle>
          <DialogDescription>
            Manage your details and workspace access.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
