# Read-only GitHub file library

The page reads files from a public GitHub repository folder and lets visitors
preview supported photos and download files. There is no upload or admin page.

## Configure it

1. Add your files directly inside a folder named `files` in your repository.
   The page reads files from this folder on the repository's `main` branch.
2. Edit the settings at the top of `javascript.js`:
   - `GITHUB_OWNER`: your GitHub username or organization.
   - `GITHUB_REPO`: the repository name.
   - `GITHUB_BRANCH`: the branch containing your site and files.
   - `GITHUB_FILES_PATH`: the folder path containing the files.
   - `VIEWER_PASSWORD`: the password visitors type on the page.
3. Publish the site with GitHub Pages.

Add or remove files in the GitHub folder and use **Refresh** on the site to
update the list. Image files such as JPG, PNG, GIF, AVIF, and WebP are previewed.
Other file types show a download button. Keep files directly inside the folder,
not in nested subfolders.

## Password limitation

This is only a simple screen in front of the file list. The password is included
in the public JavaScript, and files in a public repository can be accessed
directly without using the page. Do not use this for private or sensitive files.
