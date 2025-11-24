import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  CardMedia,
} from "@mui/material";

interface StackedCardProps {
  imageUrl?: string;
  imageHeight?: number;
  title: string;
  subtitle?: string;
  body?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function StackedCard({
  imageUrl,
  imageHeight = 220,
  title,
  subtitle,
  body,
  primaryAction,
  secondaryAction,
}: StackedCardProps) {
  return (
    <Card sx={{ maxWidth: 520 }}>
      {imageUrl ? (
        <CardMedia
          component="img"
          height={imageHeight}
          image={imageUrl}
          alt={title}
          sx={{ objectFit: "cover" }}
        />
      ) : (
        <Box
          sx={{
            height: imageHeight,
            backgroundColor: "surface.variant",
            borderRadius: 3,
            m: 2,
          }}
        />
      )}
      <CardContent>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {subtitle}
          </Typography>
        )}
        {body && (
          <Typography variant="body2" color="text.secondary">
            {body}
          </Typography>
        )}
      </CardContent>
      {(primaryAction || secondaryAction) && (
        <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2, gap: 1 }}>
          {secondaryAction && (
            <Button variant="outlined" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button variant="contained" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
        </CardActions>
      )}
    </Card>
  );
}


