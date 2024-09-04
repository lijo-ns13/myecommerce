<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Add Product</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link href="https://cdn.jsdelivr.net/npm/cropperjs@1.5.12/dist/cropper.min.css" rel="stylesheet">
</head>
<body>
    <div class="container mt-5">
        <h2 class="mb-4">Add New Product</h2>
        <form id="productForm" action="/admin/products/add-product" method="POST" enctype="multipart/form-data">
            <div class="form-group">
                <label for="product">Product Name</label>
                <input type="text" class="form-control" id="product" name="product" required>
            </div>
            <div class="form-group">
                <label for="brand">Brand</label>
                <input type="text" class="form-control" id="brand" name="brand">
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea class="form-control" id="description" name="description" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label for="price">Price</label>
                <input type="number" class="form-control" id="price" name="price" required>
            </div>
            <div class="form-group">
                <label for="size">Size</label>
                <input type="text" class="form-control" id="size" name="size" placeholder="Enter sizes separated by commas">
            </div>
            <div class="form-group">
                <label for="category">Category</label>
                <select class="form-control" id="category" name="category" required>
                    <% categories.forEach(function(category) { %>
                        <option value="<%= category._id %>"><%= category.name %></option>
                    <% }) %>
                </select>
            </div>
            <div class="form-group">
                <label for="productImages">Product Images</label>
                <input type="file" class="form-control-file" id="productImages" name="productImages" accept="image/*" multiple>
                <small class="form-text text-muted">You can upload up to 5 images.</small>
            </div>
            <div id="imagePreviewContainer" style="display:none;">
                <img id="imagePreview" style="max-width: 100%;" />
                <button type="button" id="cropButton" class="btn btn-secondary mt-2">Crop Image</button>
            </div>
            <input type="hidden" id="croppedImages" name="croppedImages">
            <button type="submit" class="btn btn-primary">Add Product</button>
        </form>
    </div>
    
    
    <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.3/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cropperjs@1.5.12/dist/cropper.min.js"></script>
    <script>
        const productImagesInput = document.getElementById('productImages');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const croppedImagesInput = document.getElementById('croppedImages');
const cropButton = document.getElementById('cropButton');
let cropper;
let croppedImagesArray = [];

// Image upload and preview for cropping
productImagesInput.addEventListener('change', function(event) {
    const files = event.target.files;

    if (files && files.length > 0) {
        const file = files[0];  // Crop first image only for now

        const reader = new FileReader();

        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = 'block';

            if (cropper) {
                cropper.destroy();
            }

            cropper = new Cropper(imagePreview, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 1,
                scalable: true
            });
        };

        reader.readAsDataURL(file);
    }
});

// Convert data URL to Blob
function dataURLToBlob(dataURL) {
    const [header, base64] = dataURL.split(',');
    const mime = header.split(':')[1].split(';')[0];
    const binary = atob(base64);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], { type: mime });
}

cropButton.addEventListener('click', function() {
    if (cropper) {
        const canvas = cropper.getCroppedCanvas();
        const croppedImageData = canvas.toDataURL('image/jpeg');

        // Add the base64 data URL to the array
        croppedImagesArray.push(croppedImageData);

        // Update the hidden input with the base64 data
        croppedImagesInput.value = JSON.stringify(croppedImagesArray);

        cropper.destroy();
        imagePreviewContainer.style.display = 'none';
    }
});



// Ensure cropped images are added before submitting
document.getElementById('productForm').addEventListener('submit', function(event) {
    if (croppedImagesArray.length === 0) {
        alert('Please crop at least one image before submitting.');
        event.preventDefault();
    }
});

    </script>
</body>
</html>

